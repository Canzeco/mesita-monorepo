"use client";

import { useEffect, useRef, useState } from "react";
import {
  Ghost,
  Loader2,
  MapPin,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  Shuffle,
  Sparkles,
  Star,
  User,
  Users,
} from "lucide-react";
import { ErrorNote, SectionCard } from "../enricher-config/atlas-ui";
import { askMemoAdmin, getMemoConfig, sampleConsumers } from "./actions";
import { MemoTrace } from "./MemoTrace";
import {
  LOCATION_PRESETS,
  type MemoPrediction,
  type MemoTurn,
  OPENAI_MODELS,
  type PersonaMode,
  type SampleConsumer,
} from "./types";

// Memo Config · Playground — a FULL chat panel that dogfoods Memo's v-next
// reasoning agent from the admin console. The operator picks who Memo is
// talking to (a real consumer sampled from the DB, a mock persona, or a
// signed-out guest) + a location, starts a session, and chats turn-by-turn.
// Every Memo reply carries a "how Memo thought" trace — the RAG-first Lineup
// recall, each OpenAI reasoning round, and every tool call (Lineup /
// Perplexity / Mesita catalog). Backed by admin-web-ask-memo (super-admin);
// read-only, nothing here writes config or user data.

const EXAMPLES = [
  "rooftop date tonight under $$$",
  "tacos al pastor cerca",
  "quiet café to work from with good wifi",
  "¿a dónde llevo a unos amigos de fuera por mezcal?",
];

const DEFAULT_GREETING = "¡Hola! Soy Memo 👋 ¿Qué se te antoja hoy?";

const MODEL_OPTIONS = ["saved", ...OPENAI_MODELS] as const;

const STATUS_BADGE: Record<
  MemoPrediction["status"],
  { label: string; cls: string }
> = {
  verified_partner_self: { label: "On Mesita", cls: "bg-secondary/10 text-secondary" },
  verified_partner_other: { label: "On Mesita", cls: "bg-secondary/10 text-secondary" },
  web_listed: { label: "Web", cls: "bg-muted text-muted-foreground" },
  not_in_mesita: { label: "Web", cls: "bg-muted text-muted-foreground" },
};

const PERSONA_MODES: { key: PersonaMode; label: string; Icon: typeof Users }[] = [
  { key: "consumer", label: "Real user", Icon: Users },
  { key: "mock", label: "Mock persona", Icon: User },
  { key: "guest", label: "Guest", Icon: Ghost },
];

function PlaceCards({ predictions }: { predictions: MemoPrediction[] }) {
  if (predictions.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
        Places surfaced ({predictions.length})
      </p>
      <ul className="mt-2 space-y-1.5">
        {predictions.map((p) => {
          const badge = STATUS_BADGE[p.status];
          return (
            <li
              key={p.placeId}
              className="border-border bg-card flex items-start gap-3 rounded-xl border p-2.5"
            >
              <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{p.mainText}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </p>
                {p.secondaryText && (
                  <p className="text-muted-foreground truncate text-xs">{p.secondaryText}</p>
                )}
              </div>
              {typeof p.rating === "number" && (
                <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs tabular-nums">
                  <Star className="h-3 w-3" />
                  {p.rating.toFixed(1)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MemoPlaygroundClient() {
  // Session config (setup phase).
  const [phase, setPhase] = useState<"setup" | "chat">("setup");
  const [personaMode, setPersonaMode] = useState<PersonaMode>("consumer");
  const [consumers, setConsumers] = useState<SampleConsumer[]>([]);
  const [loadingConsumers, setLoadingConsumers] = useState(false);
  const [consumerError, setConsumerError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SampleConsumer | null>(null);
  const [mockName, setMockName] = useState("");
  const [mockAge, setMockAge] = useState("");
  const [mockSex, setMockSex] = useState("");
  const [locationKey, setLocationKey] = useState(LOCATION_PRESETS[0].key);
  const [modelKey, setModelKey] = useState<string>("saved");

  // Saved config (greeting + model) loaded once for the session opener.
  const [greeting, setGreeting] = useState("");
  const [savedModel, setSavedModel] = useState<string | null>(null);

  // Chat state.
  const [turns, setTurns] = useState<MemoTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    getMemoConfig().then((r) => {
      if (!alive || !r.ok) return;
      setGreeting(r.data.greeting ?? "");
      setSavedModel(r.data.openaiModel ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  const loadConsumers = async () => {
    setLoadingConsumers(true);
    setConsumerError(null);
    const r = await sampleConsumers();
    if (r.ok) {
      setConsumers(r.consumers);
      setSelected(r.consumers[0] ?? null);
    } else {
      setConsumerError(r.error);
    }
    setLoadingConsumers(false);
  };

  const chooseMode = (mode: PersonaMode) => {
    setPersonaMode(mode);
    if (mode === "consumer" && consumers.length === 0 && !loadingConsumers) {
      void loadConsumers();
    }
  };

  const location = LOCATION_PRESETS.find((p) => p.key === locationKey) ?? LOCATION_PRESETS[0];
  const modelLabel = modelKey === "saved"
    ? savedModel
      ? `saved · ${savedModel}`
      : "saved default"
    : modelKey;
  const canStart = personaMode !== "consumer" || !!selected;

  const personaSummary = (): string => {
    if (personaMode === "consumer" && selected) {
      const bits = [selected.label ?? "user"];
      if (selected.age) bits.push(`${selected.age}`);
      if (selected.sex) bits.push(selected.sex);
      return `as ${bits.join(", ")}`;
    }
    if (personaMode === "mock") {
      const bits: string[] = [];
      if (mockName) bits.push(mockName);
      if (mockAge) bits.push(mockAge);
      if (mockSex) bits.push(mockSex);
      return bits.length ? `mock · ${bits.join(", ")}` : "mock persona";
    }
    return "guest (signed-out)";
  };

  const startSession = () => {
    setTurns([{ role: "assistant", content: greeting.trim() || DEFAULT_GREETING, greeting: true }]);
    setPhase("chat");
  };

  const newSession = () => {
    setTurns([]);
    setInput("");
    setBusy(false);
    setPhase("setup");
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (text.length < 2 || busy) return;

    // History = the thread so far (before this turn); the agent replays it.
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setBusy(true);

    const persona = personaMode === "consumer" && selected
      ? { consumerId: selected.id, mockProfile: null }
      : personaMode === "mock"
      ? {
        consumerId: null,
        mockProfile: {
          name: mockName || undefined,
          age: mockAge ? Number(mockAge) : undefined,
          sex: mockSex || undefined,
        },
      }
      : { consumerId: null, mockProfile: null };

    const res = await askMemoAdmin({
      query: text,
      history,
      ...persona,
      latitude: location.lat,
      longitude: location.lng,
      model: modelKey === "saved" ? null : modelKey,
    });

    setTurns((prev) => [
      ...prev,
      res.ok
        ? {
          role: "assistant",
          content: res.answer,
          predictions: res.predictions,
          related: res.related,
          citations: res.citations,
          trace: res.trace,
          meta: res.meta,
        }
        : { role: "assistant", content: "", error: res.error },
    ]);
    setBusy(false);
  };

  // ── Setup phase ─────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="space-y-6">
        <SectionCard
          icon={<MessageSquare className="text-secondary h-4 w-4" />}
          title="Start a Memo session"
          subtitle="This runs Memo's v-next reasoning agent (the engine behind the Ask AI tab) with the currently-saved persona. Pick who Memo is talking to and where, start a session, then chat — every reply shows Memo's full reasoning trace."
        >
          {/* Persona mode */}
          <div className="mt-4">
            <p className="text-muted-foreground mb-2 text-[10px] font-bold tracking-[0.12em] uppercase">
              Talk as
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PERSONA_MODES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => chooseMode(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    personaMode === key
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Persona detail */}
          {personaMode === "consumer" && (
            <div className="border-border bg-background mt-4 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Real consumer from the DB</p>
                <button
                  type="button"
                  onClick={loadConsumers}
                  disabled={loadingConsumers}
                  className="border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50"
                >
                  {loadingConsumers ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Shuffle className="h-3.5 w-3.5" />
                  )}
                  {consumers.length === 0 ? "Load users" : "Reshuffle"}
                </button>
              </div>
              {consumerError && (
                <div className="mt-3">
                  <ErrorNote message={consumerError} />
                </div>
              )}
              {consumers.length > 0 && (
                <>
                  <select
                    aria-label="Consumer"
                    value={selected?.id ?? ""}
                    onChange={(e) =>
                      setSelected(consumers.find((c) => c.id === e.target.value) ?? null)}
                    className="border-border bg-card focus:border-foreground mt-3 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  >
                    {consumers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {(c.label ?? c.id.slice(0, 8))}
                        {c.age ? ` · ${c.age}` : ""}
                        {c.sex ? ` · ${c.sex}` : ""}
                        {` · ${c.class_key}`}
                      </option>
                    ))}
                  </select>
                  {selected && (selected.saved_taste.length > 0 || selected.visited_taste.length > 0) && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Taste:{" "}
                      {[...new Set([...selected.saved_taste, ...selected.visited_taste])]
                        .slice(0, 8)
                        .join(", ") || "—"}
                    </p>
                  )}
                </>
              )}
              {consumers.length === 0 && !loadingConsumers && !consumerError && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Load a random sample of real consumers to talk as one of them. Memo reads
                  their first name, age and sex — the same signals the live concierge uses.
                </p>
              )}
            </div>
          )}

          {personaMode === "mock" && (
            <div className="border-border bg-background mt-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">First name</span>
                <input
                  value={mockName}
                  onChange={(e) => setMockName(e.target.value)}
                  placeholder="Ana"
                  maxLength={40}
                  className="border-border bg-card focus:border-foreground rounded-lg border px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Age</span>
                <input
                  value={mockAge}
                  onChange={(e) => setMockAge(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                  inputMode="numeric"
                  placeholder="27"
                  className="border-border bg-card focus:border-foreground rounded-lg border px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Sex</span>
                <select
                  value={mockSex}
                  onChange={(e) => setMockSex(e.target.value)}
                  className="border-border bg-card focus:border-foreground rounded-lg border px-3 py-2 text-sm outline-none"
                >
                  <option value="">—</option>
                  <option value="female">female</option>
                  <option value="male">male</option>
                </select>
              </label>
            </div>
          )}

          {personaMode === "guest" && (
            <p className="text-muted-foreground mt-4 text-sm">
              Memo talks to a signed-out guest — no name, age or sex, just the location and
              local time. This is the coldest-start experience.
            </p>
          )}

          {/* Location + model */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] uppercase">
                <MapPin className="h-3.5 w-3.5" /> Location
              </span>
              <select
                value={locationKey}
                onChange={(e) => setLocationKey(e.target.value)}
                className="border-border bg-card focus:border-foreground rounded-lg border px-3 py-2 text-sm outline-none"
              >
                {LOCATION_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] uppercase">
                <Sparkles className="h-3.5 w-3.5" /> Model
              </span>
              <select
                value={modelKey}
                onChange={(e) => setModelKey(e.target.value)}
                className="border-border bg-card focus:border-foreground rounded-lg border px-3 py-2 text-sm outline-none"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === "saved"
                      ? savedModel
                        ? `Saved default (${savedModel})`
                        : "Saved default"
                      : m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            {!canStart && (
              <span className="text-[11px] font-medium text-amber-600">
                Load and pick a consumer first
              </span>
            )}
            <button
              type="button"
              onClick={startSession}
              disabled={!canStart}
              className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Start session
            </button>
          </div>
        </SectionCard>
      </div>
    );
  }

  // ── Chat phase ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-2xl border p-3">
        <Sparkles className="text-secondary h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">Memo</span>
        <span className="text-muted-foreground text-xs">· agent engine</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {[personaSummary(), location.label, modelLabel].map((chip, i) => (
            <span
              key={i}
              className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[11px]"
            >
              {chip}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={newSession}
          className="border-border text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          New session
        </button>
      </div>

      {/* Thread */}
      <SectionCard
        icon={<MessageSquare className="text-secondary h-4 w-4" />}
        title="Conversation"
        subtitle="Chat with Memo as you configured. Each reply expands into its full reasoning trace."
      >
        <div className="mt-4 max-h-[560px] space-y-4 overflow-y-auto pr-1">
          {turns.map((t, i) => (
            <div key={i}>
              {t.role === "user" ? (
                <div className="flex justify-end">
                  <div className="bg-foreground text-background max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm whitespace-pre-wrap">
                    {t.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <div className="bg-secondary/10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                    <Sparkles className="text-secondary h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {t.error ? (
                      <ErrorNote message={t.error} />
                    ) : (
                      <>
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2">
                          <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                            {t.content || "(Memo returned no answer text.)"}
                          </p>
                        </div>
                        {t.predictions && <PlaceCards predictions={t.predictions} />}
                        {t.related && t.related.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {t.related.map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => send(q)}
                                disabled={busy}
                                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        )}
                        {t.citations && t.citations.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {t.citations.map((c) => (
                              <li key={c} className="truncate text-xs">
                                <a
                                  href={c}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-secondary hover:underline"
                                >
                                  {c}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                        {t.trace && t.trace.length > 0 && <MemoTrace trace={t.trace} />}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="flex gap-2.5">
              <div className="bg-secondary/10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                <Sparkles className="text-secondary h-3.5 w-3.5" />
              </div>
              <div className="bg-muted text-muted-foreground inline-flex items-center gap-2 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Memo is thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-border mt-4 border-t pt-4">
          {turns.length <= 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setInput(ex)}
                  disabled={busy}
                  className="border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              maxLength={500}
              placeholder="Message Memo…  (Enter to send, Shift+Enter for a new line)"
              disabled={busy}
              className="border-border bg-card focus:border-foreground min-h-11 flex-1 resize-none rounded-xl border px-3 py-2.5 text-sm leading-relaxed outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={busy || input.trim().length < 2}
              className="bg-foreground text-background inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
