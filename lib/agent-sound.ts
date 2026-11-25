/** Serializable synthesis data shared by the server-selected theme and the client. */
export type AgentSoundVoice = {
  waveform: "sine" | "triangle";
  frequency: number;
  endFrequency?: number;
  start: number;
  duration: number;
  gain: number;
};

export type AgentSound = { voices: readonly AgentSoundVoice[] };
