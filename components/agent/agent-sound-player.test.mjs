import assert from "node:assert/strict";
import test from "node:test";
import { playAgentSound } from "./agent-sound-player.ts";
import { AGENT_THEMES } from "../../lib/agent-theme.ts";

class AudioContextDouble {
  static instances = [];
  currentTime = 10;
  destination = {};
  nodes = [];
  closed = false;
  constructor() { AudioContextDouble.instances.push(this); }
  resume() { return Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
  createGain() {
    return {
      gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}, disconnect() {},
    };
  }
  createOscillator() {
    const node = {
      type: "sine", onended: null, startAt: null, stopAt: null, disconnected: false,
      frequency: {
        initial: null, target: null,
        setValueAtTime(value) { this.initial = value; },
        exponentialRampToValueAtTime(value) { this.target = value; },
      },
      connect() {}, disconnect() { this.disconnected = true; },
      start(time) { this.startAt = time; },
      stop(time) { this.stopAt = time; },
    };
    this.nodes.push(node);
    return node;
  }
}

async function withAudioContext(AudioContext, action) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: { AudioContext }, configurable: true });
  try { await action(); }
  finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  }
}

test("schedules the selected identity and releases its context after the final voice", async () => {
  await withAudioContext(AudioContextDouble, async () => {
    for (const theme of Object.values(AGENT_THEMES)) {
      const stop = playAgentSound(theme.sound);
      await Promise.resolve();
      const context = AudioContextDouble.instances.at(-1);
      assert.equal(context.nodes.length, theme.sound.voices.length);
      context.nodes.forEach((node, index) => {
        const voice = theme.sound.voices[index];
        assert.equal(node.type, voice.waveform);
        assert.equal(node.frequency.initial, voice.frequency);
        assert.equal(node.frequency.target, voice.endFrequency ?? null);
        assert.equal(node.startAt, context.currentTime + .015 + voice.start);
        assert.ok(node.stopAt > node.startAt);
      });
      for (const node of context.nodes.slice(0, -1)) node.onended();
      assert.equal(context.closed, false);
      context.nodes.at(-1).onended();
      assert.equal(context.closed, true);
      assert.ok(context.nodes.every(node => node.disconnected));
      assert.doesNotThrow(stop);
    }
  });
});

test("cancels playback even when resume is still pending", async () => {
  await withAudioContext(AudioContextDouble, async () => {
    const stop = playAgentSound(AGENT_THEMES.plasma.sound);
    stop();
    stop();
    await Promise.resolve();
    const context = AudioContextDouble.instances.at(-1);
    assert.equal(context.closed, true);
    assert.equal(context.nodes.length, 0);
  });
});

test("handles unavailable or blocked browser audio without breaking the click", async () => {
  await withAudioContext(undefined, async () => {
    assert.doesNotThrow(() => playAgentSound(AGENT_THEMES.photon.sound)());
  });
  class BlockedContext extends AudioContextDouble {
    resume() { return Promise.reject(new Error("Audio blocked")); }
  }
  await withAudioContext(BlockedContext, async () => {
    playAgentSound(AGENT_THEMES.photon.sound);
    await new Promise(resolve => setImmediate(resolve));
    const context = AudioContextDouble.instances.at(-1);
    assert.equal(context.closed, true);
    assert.equal(context.nodes.length, 0);
  });
});
