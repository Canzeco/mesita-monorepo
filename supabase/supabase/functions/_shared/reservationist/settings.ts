// Voice, LLM, speech recognition, turn-taking and conversation settings — the
// same for all four agents, in code. Seeded 2026-11-09 from the live a1
// (agent_0101kyjcfjecfk69ty20rmcf12gn); before that they lived only in the
// ElevenLabs console and were copied from a1 at agent creation.
// supabase-edgefunc-sync-reservationist mode "fleet" pushes them on every run.

export const LANGUAGE = "es";

export const LLM = {
  llm: "claude-haiku-4-5",
  temperature: 0.5,
  max_tokens: -1,
};

export const TTS = {
  model_id: "eleven_flash_v2_5",
  voice_id: "x5O3bgPT2grYhry6qmWR",
  speed: 1,
  stability: 0.5,
  similarity_boost: 0.75,
  optimize_streaming_latency: 3,
  agent_output_audio_format: "pcm_16000",
};

export const ASR = {
  provider: "scribe_realtime",
  quality: "high",
  user_input_audio_format: "pcm_16000",
  keywords: [] as string[],
};

export const TURN = {
  mode: "turn",
  turn_model: "turn_v3",
  turn_timeout: 7,
  turn_eagerness: "normal",
  silence_end_call_timeout: -1,
};

export const CONVERSATION = {
  max_duration_seconds: 600,
  client_events: [
    "audio",
    "interruption",
    "agent_response",
    "user_transcript",
    "agent_response_correction",
    "agent_tool_response",
  ],
};

// System tools. HARD-LEARNED 2026-08-02: built-ins are auto-enabled only for
// agents created in the dashboard; API-created agents came back with every
// built-in null (= off), so they could not hang up. An object means on.
// voicemail_detection lets the platform, not the LLM, decide "machine".
export const BUILT_IN_TOOLS: Record<string, unknown> = {
  end_call: {
    name: "end_call",
    type: "system",
    description:
      "Cuelga la llamada. Úsala solo cuando el paso actual del flujo lo indique y ya te despediste.",
    params: { system_tool_type: "end_call" },
    response_timeout_secs: 20,
  },
  voicemail_detection: {
    name: "voicemail_detection",
    type: "system",
    description: "Detecta que contestó un buzón de voz o una grabadora en lugar de una persona.",
    params: { system_tool_type: "voicemail_detection" },
    response_timeout_secs: 20,
  },
};
