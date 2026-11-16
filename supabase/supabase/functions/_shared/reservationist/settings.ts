// Voice, LLM, speech recognition, turn-taking and conversation settings — the
// same for all four agents, in code. Seeded 2026-11-09 from the live a1
// (agent_0101kyjcfjecfk69ty20rmcf12gn); before that they lived only in the
// ElevenLabs console and were copied from a1 at agent creation.
// supabase-edgefunc-sync-reservationist mode "fleet" pushes them on every run.

export const LANGUAGE = "es";

// claude-haiku-4-5. haiku-5-5 (10x cheaper) was tried 2026-11-14 and failed
// 3 of 13 simulated calls, every time at a tool node whose inputs the model
// fills (MESITA-4026); reliability is the product. The workflow stays shaped
// for a small model: webhooks fire only from tool nodes and the caller's lane
// is picked by a tool result, never by the LLM (MESITA-4022).
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

/**
 * Calls Mesita PLACES (a1, a2) open with no first message: the agent waits
 * for the other side to speak ("¿Bueno?"), at most this many seconds, and
 * only then greets (MESITA-3961, Pato: "the agent starts speaking like
 * immediatly after the call starts, give him some seconds").
 */
export const TURN_OUTBOUND = { ...TURN, initial_wait_time: 3 };

/**
 * Languages an agent may switch to mid-call (MESITA-3961, Pato: "enable
 * language swithcing"). The language_detection built-in below does the
 * switch; Spanish stays the default.
 */
export const LANGUAGE_PRESETS: Record<string, unknown> = {
  en: { overrides: { agent: { language: "en" } } },
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
  language_detection: {
    name: "language_detection",
    type: "system",
    description: "",
    params: { system_tool_type: "language_detection" },
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

/**
 * ElevenLabs guardrails (MESITA-4136, Pato: "Try to use eleven labs
 * Guardrials ... if you can set them via the api"). The fleet sync writes
 * them to platform_settings.guardrails on every run, so the console's
 * Guardrails tab is read-only in practice, like every other setting here.
 *
 * - Focus: the agent stays on its goal.
 * - Manipulation (prompt_injection): a3 answers anyone who dials Mesita.
 * - Content: checks what the AGENT says. medical_and_legal_information stays
 *   off because a1 passes on a guest's allergy note to the place.
 * - Custom: backstops for rules the prompts state and the simulated calls
 *   test (a1 · never gives the guest's phone, a1 · never agrees to a deposit,
 *   the a3 spoof calls). The prompt is the rule; the guardrail catches a slip.
 *
 * A trip never hangs up: "retry" makes the agent redo the turn with
 * GUARDRAIL_FEEDBACK, so a false positive costs one rephrased sentence, not
 * a reservation.
 */
const GUARDRAIL_FEEDBACK =
  "Tu respuesta anterior se bloqueó por una regla de Mesita ({{trigger_reason}}). En este turno no la repitas ni menciones la regla: vuelve con naturalidad a lo que toca en el flujo, en el idioma de la llamada.";

const RETRY = { type: "retry", feedback: GUARDRAIL_FEEDBACK } as const;

/** Content categories the guardrail blocks; every other one stays off. */
export const CONTENT_BLOCKED = [
  "harassment",
  "profanity",
  "religion_or_politics",
  "self_harm",
  "sexual",
  "violence",
] as const;

export const CUSTOM_GUARDRAILS = [
  {
    name: "mesita · never says a phone number or an email",
    prompt:
      "Block the agent's reply if it says a phone number (any run of 7 or more digits read as a phone, or digits grouped like a phone), part of one, or an email address. Not a violation: a reservation code of 8 digits or letters, dates, times, party sizes, prices, or saying that the other side can call back this same number without saying its digits.",
    history_message_count: 0,
  },
  {
    name: "mesita · never agrees to a payment for a table",
    prompt:
      "Block the agent's reply if it accepts, agrees to, or promises a deposit, a card guarantee, a minimum spend, a prepayment or any charge as a condition for a restaurant reservation, or says the guest will pay one in the Mesita app, in Wallet or anywhere else, or that the table is confirmed once paid. Not a violation: saying it will check with the guest and Mesita will confirm, noting the condition as an option, refusing it, or explaining that a reservation carries no payment in Mesita.",
    history_message_count: 1,
  },
] as const;

export const GUARDRAILS = {
  version: "1",
  focus: { is_enabled: true },
  prompt_injection: { is_enabled: true },
  content: {
    config: Object.fromEntries(CONTENT_BLOCKED.map((c) => [c, { is_enabled: true }])),
    trigger_action: RETRY,
  },
  custom: {
    config: {
      configs: CUSTOM_GUARDRAILS.map((g) => ({ ...g, is_enabled: true, trigger_action: RETRY })),
    },
  },
};
