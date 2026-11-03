"use client";

import { Chat } from "@ai-sdk/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import {
  DefaultChatTransport,
  isFileUIPart,
  isTextUIPart,
  type UIMessage,
} from "ai";

import type { AgentEvent } from "./agent-activity";
import { AgentRequestError } from "./send-error";

type AgentProgress = { label: string };

export type AgentUIMessage = UIMessage<
  unknown,
  { "agent-progress": AgentProgress; "agent-event": AgentEvent }
>;

export type AgentTaskStatus = {
  taskId?: string;
  status: "idle" | "running" | "completed" | "failed" | "stopped";
  progress?: string;
  partialText?: string;
  error?: string;
  message?: string;
  hasImage?: boolean;
  updatedAt?: string;
};

type AgentChatStore = {
  chat: Chat<AgentUIMessage>;
  messages: AgentUIMessage[];
  status: Chat<AgentUIMessage>["status"];
  error: Error | undefined;
  sessionId: string | null;
  agentProgress: string;
  responseDurations: Record<string, number>;
  responseStartedAt: number | null;
  task: AgentTaskStatus;
  initializeSession: () => string;
  setSessionId: (sessionId: string) => void;
  markRequestStarted: () => void;
  beginTask: (message?: string, hasImage?: boolean) => string;
  setAgentProgress: (progress: string) => void;
  setTask: (task: AgentTaskStatus) => void;
};

type AgentChatStoreHook = UseBoundStore<StoreApi<AgentChatStore>>;

const AGENT_SESSION_STORAGE_KEY = "fgmc-agent-session-id";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const transport: DefaultChatTransport<AgentUIMessage> = new DefaultChatTransport<AgentUIMessage>({
  api: "/api/admin/agent/chat",
  prepareSendMessagesRequest: ({ messages, trigger }) => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const message =
      lastUserMessage?.parts
        .filter(isTextUIPart)
        .map((part) => part.text)
        .join("") ?? "";
    const imagePart = lastUserMessage?.parts.find(isFileUIPart);

    return {
      body: {
        message,
        sessionId: useAgentChatStore.getState().sessionId,
        taskId: useAgentChatStore.getState().task.taskId,
        ...(trigger === "regenerate-message" ? { regenerate: true } : {}),
        ...(imagePart
          ? {
              imageDataUrl: imagePart.url,
              imageFilename: imagePart.filename ?? "agent-image",
            }
          : {}),
      },
    };
  },
  fetch: async (input, init) => {
    const response = await sendChatRequest(input, init);
    // Un refus (409, 4xx, 5xx) devient une erreur typée avec son statut, jamais avalée.
    if (!response.ok) throw await AgentRequestError.fromResponse(response);
    return response;
  },
});

async function sendChatRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof init?.body === "string") {
    let body: {
      message?: unknown;
      imageDataUrl?: unknown;
      imageFilename?: unknown;
      sessionId?: unknown;
      taskId?: unknown;
      regenerate?: unknown;
    };
    try {
      body = JSON.parse(init.body) as typeof body;
    } catch {
      return globalThis.fetch(input, init);
    }
    if (typeof body.imageDataUrl === "string") {
      const imageResponse = await globalThis.fetch(body.imageDataUrl);
      const imageBlob = await imageResponse.blob();
      const formData = new FormData();
      formData.set("message", typeof body.message === "string" ? body.message : "");
      if (typeof body.sessionId === "string") formData.set("sessionId", body.sessionId);
      if (typeof body.taskId === "string") formData.set("taskId", body.taskId);
      if (body.regenerate === true) formData.set("regenerate", "true");
      formData.set(
        "image",
        imageBlob,
        typeof body.imageFilename === "string" ? body.imageFilename : "agent-image",
      );
      const headers = new Headers(init.headers);
      headers.delete("content-type");
      return globalThis.fetch(input, { ...init, headers, body: formData });
    }
  }
  return globalThis.fetch(input, init);
}

const sharedChat: Chat<AgentUIMessage> = new Chat<AgentUIMessage>({
  transport,
  onData: (dataPart) => {
    if (dataPart.type !== "data-agent-progress" || !isRecord(dataPart.data)) return;
    if (typeof dataPart.data.label === "string") {
      useAgentChatStore.getState().setAgentProgress(dataPart.data.label);
    }
  },
  onFinish: ({ message, isAbort, isDisconnect, isError }) => {
    const store = useAgentChatStore.getState();
    const startedAt = store.responseStartedAt;
    useAgentChatStore.setState((current) => ({
      responseStartedAt: null,
      agentProgress: "Je réfléchis à votre demande…",
      ...(isAbort || isDisconnect || isError
        ? {}
        : {
            task: {
              ...current.task,
              status: "completed",
              progress: "Travail terminé.",
            },
          }),
    }));
    if (startedAt !== null && !isAbort && !isDisconnect && !isError) {
      useAgentChatStore.setState((current) => ({
        responseDurations: {
          ...current.responseDurations,
          [message.id]: performance.now() - startedAt,
        },
      }));
    }
  },
  onError: () => {
    useAgentChatStore.setState({ responseStartedAt: null });
  },
});

export const useAgentChatStore: AgentChatStoreHook = create<AgentChatStore>((set, get) => ({
  chat: sharedChat,
  messages: sharedChat.messages,
  status: sharedChat.status,
  error: sharedChat.error,
  sessionId: null,
  agentProgress: "Je réfléchis à votre demande…",
  responseDurations: {},
  responseStartedAt: null,
  task: { status: "idle" },
  initializeSession: () => {
    const current = get().sessionId;
    if (current) return current;
    const saved = window.localStorage.getItem(AGENT_SESSION_STORAGE_KEY);
    const sessionId = saved || crypto.randomUUID();
    if (!saved) window.localStorage.setItem(AGENT_SESSION_STORAGE_KEY, sessionId);
    set({ sessionId });
    return sessionId;
  },
  setSessionId: (sessionId) => {
    window.localStorage.setItem(AGENT_SESSION_STORAGE_KEY, sessionId);
    set({ sessionId });
  },
  markRequestStarted: () => set({ responseStartedAt: performance.now() }),
  beginTask: (message, hasImage = false) => {
    const taskId = crypto.randomUUID();
    set({
      task: {
        taskId,
        status: "running",
        progress: "Je réfléchis à votre demande…",
        ...(message ? { message } : {}),
        ...(hasImage ? { hasImage: true } : {}),
      },
    });
    return taskId;
  },
  setAgentProgress: (agentProgress) =>
    set((current) => ({
      agentProgress,
      ...(current.task.status === "running"
        ? { task: { ...current.task, progress: agentProgress } }
        : {}),
    })),
  setTask: (task) => set({ task }),
}));

sharedChat["~registerMessagesCallback"](() => {
  useAgentChatStore.setState({ messages: sharedChat.messages });
});
sharedChat["~registerStatusCallback"](() => {
  useAgentChatStore.setState({ status: sharedChat.status, error: sharedChat.error });
});
sharedChat["~registerErrorCallback"](() => {
  useAgentChatStore.setState({ error: sharedChat.error });
});

