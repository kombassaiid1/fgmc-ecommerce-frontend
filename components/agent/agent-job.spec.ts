import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_JOB_STORAGE_KEY,
  AGENT_JOB_FAILED_MESSAGE,
  AGENT_JOB_LOST_MESSAGE,
  AGENT_JOB_MAX_DURATION_MS,
  AGENT_JOB_NETWORK_MESSAGE,
  AGENT_JOB_TIMEOUT_MESSAGE,
  AgentJobHttpError,
  clearActiveJob,
  formatElapsed,
  loadActiveJob,
  pollAgentJob,
  saveActiveJob,
  type AgentJobSnapshot,
  type JobStorage,
} from "./agent-job.ts";

function snapshot(status: AgentJobSnapshot["status"], extra: Partial<AgentJobSnapshot> = {}): AgentJobSnapshot {
  return {
    job_id: "job-1", status, progress: "", result: { text: "", events: [] },
    error: null, created_at: "", updated_at: "", ...extra,
  };
}

function scripted(steps: Array<AgentJobSnapshot | Error>) {
  const queue = [...steps];
  const calls: string[] = [];
  return {
    calls,
    fetchJob: async (jobId: string) => {
      calls.push(jobId);
      const step = queue.shift();
      if (!step) throw new Error("plus de réponse prévue");
      if (step instanceof Error) throw step;
      return step;
    },
  };
}

const noSleep = async () => undefined;

describe("pollAgentJob", () => {
  it("relaie les états en cours puis s'arrête sur done", async () => {
    const updates: string[] = [];
    const { fetchJob, calls } = scripted([
      snapshot("pending"),
      snapshot("running", { progress: "Je consulte le catalogue…" }),
      snapshot("done", { result: { text: "Voici la fiche.", events: [] } }),
    ]);
    const sleeps: number[] = [];
    const outcome = await pollAgentJob({
      jobId: "job-1", startedAt: 0, fetchJob, now: () => 1_000,
      onUpdate: (job) => updates.push(job.progress || job.status),
      sleep: async (ms) => { sleeps.push(ms); },
    });
    assert.equal(outcome.kind, "done");
    assert.deepEqual(updates, ["pending", "Je consulte le catalogue…"]);
    assert.equal(calls.length, 3);
    assert.deepEqual(sleeps, [2_000, 2_000]); // un relevé toutes les 2 s
  });

  it("retente après une panne passagère, avec compteur remis à zéro après un succès", async () => {
    const boom = new Error("réseau");
    const { fetchJob } = scripted([
      boom, boom, boom, boom, snapshot("running"),
      boom, boom, boom, boom, snapshot("done"),
    ]);
    const outcome = await pollAgentJob({ jobId: "job-1", startedAt: 0, fetchJob, now: () => 0, sleep: noSleep });
    assert.equal(outcome.kind, "done");
  });

  it("abandonne après 5 échecs consécutifs avec un message clair", async () => {
    const failing = new AgentJobHttpError(502);
    const { fetchJob, calls } = scripted([failing, failing, failing, failing, failing, snapshot("done")]);
    const outcome = await pollAgentJob({ jobId: "job-1", startedAt: 0, fetchJob, now: () => 0, sleep: noSleep });
    assert.deepEqual(outcome, { kind: "network", message: AGENT_JOB_NETWORK_MESSAGE });
    assert.equal(calls.length, 5);
  });

  it("signale une tâche inconnue (404) et une session expirée (401) sans réessayer", async () => {
    const lost = await pollAgentJob({
      jobId: "job-1", startedAt: 0, now: () => 0, sleep: noSleep,
      fetchJob: scripted([new AgentJobHttpError(404), snapshot("done")]).fetchJob,
    });
    assert.deepEqual(lost, { kind: "lost", message: AGENT_JOB_LOST_MESSAGE });
    const auth = await pollAgentJob({
      jobId: "job-1", startedAt: 0, now: () => 0, sleep: noSleep,
      fetchJob: scripted([new AgentJobHttpError(401)]).fetchJob,
    });
    assert.equal(auth.kind, "auth");
  });

  it("renvoie le message d'erreur de la tâche, ou un message par défaut", async () => {
    const withMessage = await pollAgentJob({
      jobId: "job-1", startedAt: 0, now: () => 0, sleep: noSleep,
      fetchJob: scripted([snapshot("error", { error: "Le contexte est trop long." })]).fetchJob,
    });
    assert.equal(withMessage.kind === "error" && withMessage.message, "Le contexte est trop long.");
    const withoutMessage = await pollAgentJob({
      jobId: "job-1", startedAt: 0, now: () => 0, sleep: noSleep,
      fetchJob: scripted([snapshot("error")]).fetchJob,
    });
    assert.equal(withoutMessage.kind === "error" && withoutMessage.message, AGENT_JOB_FAILED_MESSAGE);
  });

  it("s'arrête après 10 minutes, y compris quand le début vient d'avant un rafraîchissement", async () => {
    const { fetchJob, calls } = scripted([snapshot("running"), snapshot("running"), snapshot("running")]);
    let clock = 0;
    const outcome = await pollAgentJob({
      jobId: "job-1", startedAt: 0, fetchJob, now: () => clock,
      sleep: async (ms) => { clock += ms * 100; }, // le temps avance vite : 200 s par relevé
    });
    assert.deepEqual(outcome, { kind: "timeout", message: AGENT_JOB_TIMEOUT_MESSAGE });
    assert.ok(calls.length >= 3 && calls.length <= 4);

    const alreadyOld = await pollAgentJob({
      jobId: "job-1", startedAt: 0, fetchJob: scripted([]).fetchJob,
      now: () => AGENT_JOB_MAX_DURATION_MS, sleep: noSleep,
    });
    assert.equal(alreadyOld.kind, "timeout");
  });

  it("s'arrête proprement quand le suivi est annulé", async () => {
    const controller = new AbortController();
    controller.abort();
    const outcome = await pollAgentJob({
      jobId: "job-1", startedAt: 0, fetchJob: scripted([]).fetchJob, signal: controller.signal,
    });
    assert.deepEqual(outcome, { kind: "aborted" });
  });
});

describe("formatElapsed", () => {
  it("affiche minutes:secondes", () => {
    assert.equal(formatElapsed(0), "0:00");
    assert.equal(formatElapsed(45_999), "0:45");
    assert.equal(formatElapsed(65_000), "1:05");
    assert.equal(formatElapsed(12 * 60_000 + 3_000), "12:03");
    assert.equal(formatElapsed(-5), "0:00");
  });
});

function memoryStorage(): JobStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

describe("tâche active conservée après rafraîchissement", () => {
  const job = { jobId: "job-1", sessionId: "session-1", startedAt: 1_000, message: "Montre la fiche", hasImage: false };

  it("enregistre, relit puis efface la tâche", () => {
    const storage = memoryStorage();
    saveActiveJob(storage, job);
    assert.deepEqual(loadActiveJob(storage, 5_000), job);
    clearActiveJob(storage);
    assert.equal(loadActiveJob(storage, 5_000), null);
  });

  it("ignore et efface une tâche plus vieille que 10 minutes ou un contenu invalide", () => {
    const storage = memoryStorage();
    saveActiveJob(storage, job);
    assert.equal(loadActiveJob(storage, 1_000 + AGENT_JOB_MAX_DURATION_MS), null);
    assert.equal(storage.data.has(ACTIVE_JOB_STORAGE_KEY), false);

    storage.setItem(ACTIVE_JOB_STORAGE_KEY, "{pas du json");
    assert.equal(loadActiveJob(storage, 2_000), null);
    storage.setItem(ACTIVE_JOB_STORAGE_KEY, JSON.stringify({ jobId: "../x", sessionId: "s", startedAt: 1_500 }));
    assert.equal(loadActiveJob(storage, 2_000), null);
  });

  it("n'échoue pas quand le stockage est indisponible", () => {
    const broken: JobStorage = {
      getItem: () => { throw new Error("bloqué"); },
      setItem: () => { throw new Error("bloqué"); },
      removeItem: () => { throw new Error("bloqué"); },
    };
    saveActiveJob(broken, job);
    clearActiveJob(broken);
    assert.equal(loadActiveJob(broken, 2_000), null);
  });
});
