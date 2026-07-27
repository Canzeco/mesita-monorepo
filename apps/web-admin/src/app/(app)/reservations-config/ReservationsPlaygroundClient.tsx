"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Loader2,
  MessageSquareText,
  Phone,
  PhoneCall,
  RefreshCw,
  SlidersHorizontal,
  TriangleAlert,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { ErrorNote, SectionCard } from "../enricher-config/atlas-ui";
import {
  createPlaygroundReservation,
  listConsumerTargets,
  listPlaceTargets,
  listPlaygroundReservations,
  type ConsumerTarget,
  type NumberMode,
  type PlaceTarget,
  type PlaygroundTicket,
} from "./actions";
import { looksLikePhone, type ReservationsConfig } from "./catalog";

// Reservations Playground — FAKE USERS ONLY, kept simple on purpose. The page is
// four boxes, top to bottom:
//
//   1. Participants — the business + the consumer (ten real DB rows each, click
//      one) and the phone each side uses (test line or the actual DB number).
//   2. Intent — the booking the fake user wants (date & time, party, requests).
//   3. Tune & run — the effective call settings (how many intents, the resolved
//      numbers) and the trigger. A run creates the TICKET IMMEDIATELY, then up
//      to config.attempts real calls (the "intents") fire server-side.
//   4. Sandbox — every emulated ticket, remembered, with its live intent-by-
//      intent lifecycle.
//
// Tickets live in playground_reservations (never public.reservations) and the
// sandbox polls while intents are running, so progress shows live.

const inputCls =
  "border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-sm outline-none";

// How long the sandbox keeps polling a running ticket before assuming the
// background loop died (its wall clock is far shorter than this).
const RUNNING_POLL_WINDOW_MS = 10 * 60 * 1000;
const POLL_MS = 8_000;

// Venue-local (Mexico City) formatting for sandbox tickets.
function mxDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function Labeled({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Target grid — ten pre-loaded real rows, click one. No search. ────────────

function TargetGrid<T extends { id: string; name: string; phone: string | null }>({
  icon,
  label,
  selected,
  onSelect,
  load,
  metaLine,
}: {
  icon: React.ReactNode;
  label: string;
  selected: T | null;
  onSelect: (t: T) => void;
  load: () => Promise<{ ok: true; results: T[] } | { ok: false; error: string }>;
  metaLine?: (t: T) => string | null;
}) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await load();
      if (!active) return;
      if (r.ok) setItems(r.results);
      else setError(r.error);
    })();
    return () => {
      active = false;
    };
  }, [load, nonce]);

  return (
    <div className="border-border bg-background rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          {icon}
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            setItems(null);
            setError(null);
            setNonce((n) => n + 1);
          }}
          aria-label={`Reload ${label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-xs text-amber-600">{error}</p>
      ) : items === null ? (
        <p className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-xs">Nothing in the database yet.</p>
      ) : (
        <div className="mt-3 grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {items.map((t) => {
            const active = selected?.id === t.id;
            const meta = metaLine?.(t);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(t)}
                className={
                  "rounded-lg border p-2 text-left transition " +
                  (active
                    ? "border-secondary bg-secondary/[0.06] ring-secondary/30 ring-1"
                    : "border-border bg-card hover:border-foreground/30")
                }
              >
                <p className="truncate text-xs font-semibold">{t.name}</p>
                <p className="text-muted-foreground truncate font-mono text-[10px]">
                  {t.phone ?? "no phone"}
                  {meta ? ` · ${meta}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Number-mode toggle (test line vs actual DB phone) ────────────────────────

function NumberModePicker({
  label,
  mode,
  onChange,
  testNumber,
  testUnsetHint,
  actualNumber,
  actualMissingHint,
  danger,
}: {
  label: string;
  mode: NumberMode;
  onChange: (m: NumberMode) => void;
  testNumber: string | null;
  testUnsetHint: string;
  actualNumber: string | null;
  actualMissingHint: string;
  danger?: boolean;
}) {
  const opts: { key: NumberMode; title: string; value: string | null; hint: string }[] = [
    { key: "test", title: "Test number", value: testNumber, hint: testUnsetHint },
    { key: "actual", title: "Actual number", value: actualNumber, hint: actualMissingHint },
  ];
  return (
    <div className="border-border bg-background rounded-xl border p-4">
      <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <Phone className="h-3.5 w-3.5" />
        {label}
      </span>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {opts.map((o) => {
          const active = mode === o.key;
          const disabled = !o.value;
          const dangerous = danger && o.key === "actual";
          return (
            <button
              key={o.key}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(o.key)}
              className={
                "rounded-lg border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 " +
                (active
                  ? dangerous
                    ? "border-amber-500 bg-amber-500/[0.08] ring-1 ring-amber-500/40"
                    : "border-secondary bg-secondary/[0.06] ring-secondary/30 ring-1"
                  : "border-border bg-card hover:border-foreground/30")
              }
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                {o.title}
                {dangerous && <TriangleAlert className="h-3 w-3 text-amber-600" />}
              </span>
              <span
                className={
                  "mt-0.5 block truncate font-mono text-[11px] " +
                  (o.value ? "text-foreground" : "text-muted-foreground")
                }
              >
                {o.value ?? o.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sandbox ticket card ──────────────────────────────────────────────────────

function intentChip(result: string | null, n: number, running: boolean) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold";
  if (result === null) {
    if (!running) return null; // terminal ticket — this intent never fired
    return (
      <span key={n} className={`${base} text-muted-foreground bg-muted`}>
        intent {n}
      </span>
    );
  }
  if (result === "answered") {
    return (
      <span key={n} className={`${base} bg-emerald-500/10 text-emerald-700`}>
        <CheckCircle2 className="h-3 w-3" /> intent {n}: answered
      </span>
    );
  }
  if (result === "no_answer") {
    return (
      <span key={n} className={`${base} bg-red-500/10 text-red-700`}>
        <XCircle className="h-3 w-3" /> intent {n}: no answer
      </span>
    );
  }
  if (result === "dialing" || result === "ringing") {
    return (
      <span key={n} className={`${base} bg-secondary/10 text-secondary`}>
        <Loader2 className="h-3 w-3 animate-spin" /> intent {n}: {result}
      </span>
    );
  }
  if (result === "unknown") {
    return (
      <span key={n} className={`${base} bg-amber-500/10 text-amber-700`}>
        intent {n}: unknown
      </span>
    );
  }
  return (
    <span key={n} className={`${base} bg-red-500/10 text-red-700`}>
      <XCircle className="h-3 w-3" /> intent {n}: failed
    </span>
  );
}

function TicketCard({ t }: { t: PlaygroundTicket }) {
  const running = t.attempts_state === "running";
  const attempts = Array.isArray(t.attempts) ? t.attempts : [];
  const badge =
    t.attempts_state === "answered" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> answered
      </span>
    ) : t.attempts_state === "exhausted" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
        <XCircle className="h-3 w-3" /> no answer
      </span>
    ) : t.attempts_state === "error" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
        <XCircle className="h-3 w-3" /> {t.call_status ?? "error"}
      </span>
    ) : (
      <span className="text-secondary bg-secondary/10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
        <Loader2 className="h-3 w-3 animate-spin" /> intents running
      </span>
    );

  return (
    <li className="border-border bg-card rounded-2xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{t.place_name}</span>
        <span className="text-muted-foreground text-xs">for</span>
        <span className="text-sm font-medium">{t.consumer_name}</span>
        <span className="ml-auto">{badge}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {Array.from({ length: Math.max(t.attempts_planned, attempts.length) }, (_, i) =>
          intentChip(attempts[i]?.result ?? null, i + 1, running),
        )}
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          {mxDateTime(t.reserved_at)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {t.party_size}
        </span>
        {t.notes && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t.notes}</span>
          </span>
        )}
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span>
          venue{" "}
          <span className="text-foreground font-mono">{t.business_number ?? "—"}</span>{" "}
          <span className="border-border bg-background rounded-full border px-1.5 py-px text-[9px] font-medium uppercase">
            {t.business_number_mode}
          </span>
        </span>
        <span>
          guest{" "}
          <span className="text-foreground font-mono">{t.consumer_number ?? "—"}</span>{" "}
          <span className="border-border bg-background rounded-full border px-1.5 py-px text-[9px] font-medium uppercase">
            {t.consumer_number_mode}
          </span>
        </span>
        {t.conversation_id && (
          <span className="min-w-0">
            conv <span className="font-mono break-all">{t.conversation_id}</span>
          </span>
        )}
        <span className="ml-auto">{mxDateTime(t.created_at)}</span>
      </div>
    </li>
  );
}

// A single read-only "what the run will do" tile for the Tune & run box.
function TuneTile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "danger";
}) {
  return (
    <div className="border-border bg-background rounded-xl border p-3">
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="text-foreground mt-1 truncate font-mono text-sm font-semibold">{value}</p>
      {note && (
        <p
          className={
            "mt-0.5 text-[10px] font-medium uppercase " +
            (tone === "danger" ? "text-amber-600" : "text-muted-foreground")
          }
        >
          {note}
        </p>
      )}
    </div>
  );
}

// ── The playground ───────────────────────────────────────────────────────────

export function ReservationsPlaygroundClient({
  config,
  loadError,
}: {
  config: ReservationsConfig;
  loadError: string | null;
}) {
  const [place, setPlace] = useState<PlaceTarget | null>(null);
  const [consumer, setConsumer] = useState<ConsumerTarget | null>(null);
  const [when, setWhen] = useState("");
  const [party, setParty] = useState(2);
  const [notes, setNotes] = useState("");
  const [businessMode, setBusinessMode] = useState<NumberMode>("test");
  const [consumerMode, setConsumerMode] = useState<NumberMode>("test");

  const [placing, setPlacing] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [justRan, setJustRan] = useState(false);

  const [tickets, setTickets] = useState<PlaygroundTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const businessTest = looksLikePhone(config.testCall.number)
    ? config.testCall.number.trim()
    : null;
  const consumerTest = looksLikePhone(config.testCall.consumerNumber)
    ? config.testCall.consumerNumber.trim()
    : null;

  // The sandbox is remembered server-side — load it on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await listPlaygroundReservations();
      if (!active) return;
      if (r.ok) setTickets(r.tickets);
      else setTicketsError(r.error);
      setTicketsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Live progress: while any ticket's intent loop is running, poll. The
  // interval stops itself once every running ticket is stale (a crashed loop
  // can leave 'running' behind) — recency is checked in the callback, where
  // Date.now() is allowed.
  const hasRunning = tickets.some((t) => t.attempts_state === "running");
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(async () => {
      const r = await listPlaygroundReservations();
      if (!r.ok) return;
      setTickets(r.tickets);
      const stillLive = r.tickets.some(
        (t) =>
          t.attempts_state === "running" &&
          Date.now() - Date.parse(t.created_at) < RUNNING_POLL_WINDOW_MS,
      );
      if (!stillLive) clearInterval(id);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [hasRunning]);

  // Effective modes are DERIVED, never stored invalid: a requested mode whose
  // number is unavailable falls back to the side's available option (or 'test',
  // leaving the number null so the run stays blocked with a hint).
  const effBusinessMode: NumberMode =
    businessMode === "actual" && place?.phone ? "actual" : "test";
  const effConsumerMode: NumberMode =
    consumerMode === "actual"
      ? consumer?.phone
        ? "actual"
        : "test"
      : consumerTest
        ? "test"
        : consumer?.phone
          ? "actual"
          : "test";

  const businessNumber = effBusinessMode === "test" ? businessTest : place?.phone ?? null;
  const consumerNumber = effConsumerMode === "test" ? consumerTest : consumer?.phone ?? null;

  const canRun =
    !!place && !!consumer && !!when && !!businessNumber && !!consumerNumber && !placing;

  async function onRun() {
    if (!place || !consumer) return;
    setPlacing(true);
    setRunError(null);
    setJustRan(false);
    try {
      const r = await createPlaygroundReservation({
        project_id: place.id,
        consumer_id: consumer.id,
        reserved_at: when,
        party_size: party,
        notes: notes.trim(),
        business_number_mode: effBusinessMode,
        consumer_number_mode: effConsumerMode,
      });
      if (!r.ok) {
        setRunError(r.error);
        return;
      }
      setJustRan(true);
      setTickets((prev) => [r.ticket, ...prev.filter((p) => p.id !== r.ticket.id)]);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="space-y-6">
      {loadError && <ErrorNote message={loadError} />}

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5 text-xs text-amber-700">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Fake users only — but the calls are real.</span>{" "}
          A run creates its ticket immediately, then up to{" "}
          <span className="font-semibold">{config.attempts}</span> call intent
          {config.attempts === 1 ? "" : "s"} fire for real (ElevenLabs/Twilio
          spend) — if the line doesn&apos;t answer, the next intent dials. Tickets
          stay in the playground sandbox, never in real consumer reservations.
        </p>
      </div>

      {/* ── 1 · Participants — business, consumer & phones ── */}
      <SectionCard
        icon={<Users className="text-secondary h-4 w-4" />}
        title="Business, consumer & phones"
        subtitle="Who's on the call — a real place and a real consumer from the Mesita DB — and which number each side uses."
      >
        <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
          <TargetGrid
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Place (from database)"
            selected={place}
            onSelect={setPlace}
            load={listPlaceTargets}
            metaLine={(p) => p.address}
          />
          <TargetGrid
            icon={<User className="h-3.5 w-3.5" />}
            label="Consumer (from database)"
            selected={consumer}
            onSelect={setConsumer}
            load={listConsumerTargets}
          />
        </div>
        <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2">
          <NumberModePicker
            label="Business number — what the agent dials"
            mode={effBusinessMode}
            onChange={setBusinessMode}
            testNumber={businessTest}
            testUnsetHint="set the business test number in Config"
            actualNumber={place?.phone ?? null}
            actualMissingHint={place ? "this place has no phone" : "pick a place first"}
            danger
          />
          <NumberModePicker
            label="Consumer number — the guest callback in the brief"
            mode={effConsumerMode}
            onChange={setConsumerMode}
            testNumber={consumerTest}
            testUnsetHint="set the consumer test number in Config"
            actualNumber={consumer?.phone ?? null}
            actualMissingHint={
              consumer ? "this consumer has no phone" : "pick a consumer first"
            }
          />
        </div>
        {effBusinessMode === "actual" && place?.phone && (
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Actual business number selected — every intent of this run will ring{" "}
            <span className="font-semibold">{place.name}</span> on its real line (
            <span className="font-mono">{place.phone}</span>).
          </p>
        )}
      </SectionCard>

      {/* ── 2 · Intent — the booking params ── */}
      <SectionCard
        icon={<CalendarClock className="text-secondary h-4 w-4" />}
        title="The intent"
        subtitle="The booking the fake user wants."
      >
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <Labeled
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Date & time (venue local)"
          >
            <input
              type="datetime-local"
              className={inputCls}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </Labeled>
          <Labeled icon={<Users className="h-3.5 w-3.5" />} label="Party size">
            <input
              type="number"
              min={1}
              max={20}
              className={inputCls + " tabular-nums"}
              value={party}
              onChange={(e) =>
                setParty(
                  Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))),
                )
              }
            />
          </Labeled>
          <div className="sm:col-span-2">
            <Labeled
              icon={<MessageSquareText className="h-3.5 w-3.5" />}
              label="Special requests"
            >
              <input
                className={inputCls}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="mesa afuera, cumpleaños…"
              />
            </Labeled>
          </div>
        </div>
      </SectionCard>

      {/* ── 3 · Tune & run ── */}
      <SectionCard
        icon={<SlidersHorizontal className="text-secondary h-4 w-4" />}
        title="Tune & run"
        subtitle="What the run will do, resolved from the numbers above and the saved config. Tune the retry count in the Config tab."
      >
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <TuneTile
            label="Call intents"
            value={`up to ${config.attempts}`}
            note="from Config · attempts"
          />
          <TuneTile
            label="Business dials"
            value={businessNumber ?? "—"}
            note={effBusinessMode === "actual" ? "actual venue line" : "test number"}
            tone={effBusinessMode === "actual" ? "danger" : undefined}
          />
          <TuneTile
            label="Guest callback"
            value={consumerNumber ?? "—"}
            note={effConsumerMode === "actual" ? "actual consumer phone" : "test number"}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {placing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating ticket…
              </>
            ) : (
              <>
                <PhoneCall className="h-3.5 w-3.5" />
                Create ticket &amp; start intents
              </>
            )}
          </button>
        </div>

        {!canRun && !placing && (
          <p className="text-muted-foreground mt-3 text-xs">
            {!place
              ? "Pick a place."
              : !consumer
                ? "Pick a consumer."
                : !when
                  ? "Pick a date & time."
                  : !businessNumber
                    ? "No business number available — set the test number in Config."
                    : !consumerNumber
                      ? "No consumer number available — set the consumer test number in Config or pick a consumer with a phone."
                      : null}
          </p>
        )}

        {justRan && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5 text-xs text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">Ticket created — intents are running.</span>{" "}
              Intent 1 is dialing now; progress updates live on the ticket below.
            </p>
          </div>
        )}
        {runError && (
          <div className="mt-4">
            <ErrorNote message={runError} />
          </div>
        )}
      </SectionCard>

      {/* ── 4 · Sandbox — playground tickets + lifecycle ── */}
      <SectionCard
        icon={<Inbox className="text-secondary h-4 w-4" />}
        title="Sandbox — playground tickets"
        subtitle="Every emulated reservation, remembered, with its intent-by-intent lifecycle. These live only in the playground."
      >
        {ticketsLoading ? (
          <p className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
          </p>
        ) : ticketsError ? (
          <div className="mt-4">
            <ErrorNote message={ticketsError} />
          </div>
        ) : tickets.length === 0 ? (
          <div className="border-border bg-muted/30 mt-4 flex items-center gap-3 rounded-xl border border-dashed p-6">
            <Inbox className="text-muted-foreground h-5 w-5" />
            <p className="text-muted-foreground text-sm">
              No playground tickets yet — run an intent above and it lands here.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {tickets.map((t) => (
              <TicketCard key={t.id} t={t} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
