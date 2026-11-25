import type { AgentSound } from "@/lib/agent-sound";

/** Called directly from the opening click, so browsers can authorize playback. */
export function playAgentSound(sound: AgentSound): () => void {
  if (typeof window === "undefined" || !window.AudioContext) return () => {};
  let context: AudioContext;
  try {
    context = new window.AudioContext();
  } catch {
    return () => {};
  }
  const oscillators: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const oscillator of oscillators) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* A node may not have started if setup failed. */ }
      oscillator.disconnect();
    }
    gains.forEach(gain => gain.disconnect());
    void context.close().catch(() => {});
  };
  // resume() runs during the gesture; scheduling waits for the audio clock to run.
  void context.resume().then(() => {
    if (stopped) return;
    try {
      const master = context.createGain();
      master.gain.value = .12;
      master.connect(context.destination);
      gains.push(master);
      const origin = context.currentTime + .015;
      let remaining = sound.voices.length;
      if (!remaining) { stop(); return; }
      for (const voice of sound.voices) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillators.push(oscillator);
        gains.push(envelope);
        const start = origin + voice.start;
        const end = start + voice.duration;
        oscillator.type = voice.waveform;
        oscillator.frequency.setValueAtTime(voice.frequency, start);
        if (voice.endFrequency !== undefined) oscillator.frequency.exponentialRampToValueAtTime(voice.endFrequency, end);
        // Smooth attack and release avoid click artifacts; sounds stay under one second.
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(voice.gain, start + .018);
        envelope.gain.exponentialRampToValueAtTime(.0001, end);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.onended = () => {
          oscillator.disconnect();
          envelope.disconnect();
          remaining -= 1;
          if (!remaining) stop();
        };
        oscillator.start(start);
        oscillator.stop(end + .015);
      }
    } catch {
      stop();
    }
  }).catch(stop);
  return stop;
}
