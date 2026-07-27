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

// Reservations Playground — FAKE USERS ONLY, kept simple on purpose:
//
//   1. Pick a place — ten real rows from the DB, click one (no search bar).
//   2. Pick a consumer — same.
//   3. Author the intent (date & time, party size, special requests).
//   4. Choose each side's number: test line or the actual DB phone.
//   5. Run it — the TICKET IS CREATED IMMEDIATELY, then the intents start:
//      up to config.attempts real calls (the "3 intents"), server-side. If the
//      venue doesn't answer intent 1, intent 2 dials, then intent 3.
//
// Tickets live in playground_reservations (never public.reservations) and the
// sandbox below polls while intents are running, so progress shows live.

const inputCls =
  "border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-sm outline-none";

// ── Hour slots ───────────────────────────────────────────────────────────────
// Reservation-style pick-one chips, 30-minute steps. The list starts at 8:00
// a.m. and wraps the full day, so dining hours lead and the small-hours edge
// cases (the 3 a.m. AI-receptionist test) sit at the end of the scroll. Values
// stay "HH:mm" — exactly what the type=time input produced.
const TIME_SLOTS: { value: string; label: string }[] = Array.from(
  { length: 48 },
  (_, i) => {
    const half = (16 + i) % 48; // rotate so 08:00 is first
    const h = Math.floor(half / 2);
    const m = half % 2 === 0 ? "00" : "30";
    const h12 = ((h + 11) % 12) + 1;
    return {
      value: `${String(h).padStart(2, "0")}:${m}`,
      label: `${h12}:${m} ${h < 12 ? "a.m." : "p.m."}`,
    };
  },
);

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
  if (result === "confirmed") {
    return (
      <span key={n} className={`${base} bg-emerald-500/10 text-emerald-700`}>
        <CheckCircle2 className="h-3 w-3" /> intent {n}: confirmed
      </span>
    );
  }
  if (result === "declined") {
    return (
      <span key={n} className={`${base} bg-red-500/10 text-red-700`}>
        <XCircle className="h-3 w-3" /> intent {n}: declined
      </span>
    );
  }
  if (result === "unresolved") {
    return (
      <span key={n} className={`${base} bg-amber-500/10 text-amber-700`}>
        intent {n}: no verdict
      </span>
    );
  }
  if (result === "answered") {
    return (
      <span key={n} className={`${base} bg-secondary/10 text-secondary`}>
        {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}{" "}
        intent {n}: answered
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

// The guest-confirmation chip — leg 2 (business → consumer), shown once leg 1
// has settled. `skipped` renders nothing: the verdict badge already says why.
function guestCallChip(state: string) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold";
  if (state === "calling" || state === "ringing") {
    return (
      <span className={`${base} bg-secondary/10 text-secondary`}>
        <Loader2 className="h-3 w-3 animate-spin" /> guest call: {state}
      </span>
    );
  }
  if (state === "answered") {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-700`}>
        <PhoneCall className="h-3 w-3" /> guest confirmed by phone
      </span>
    );
  }
  if (state === "no_answer") {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-700`}>
        <PhoneCall className="h-3 w-3" /> guest call: no answer
      </span>
    );
  }
  if (state === "failed" || state === "unknown") {
    return (
      <span className={`${base} bg-red-500/10 text-red-700`}>
        <XCircle className="h-3 w-3" /> guest call: {state}
      </span>
    );
  }
  return null; // none | skipped
}

function TicketCard({ t }: { t: PlaygroundTicket }) {
  const running = t.attempts_state === "running";
  const attempts = Array.isArray(t.attempts) ? t.attempts : [];
  const badge = running ? (
    <span className="text-secondary bg-secondary/10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
      <Loader2 className="h-3 w-3 animate-spin" /> intents running
    </span>
  ) : t.status === "confirmed" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> confirmed
    </span>
  ) : t.status === "declined" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
      <XCircle className="h-3 w-3" /> declined
    </span>
  ) : t.status === "unreachable" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
      <XCircle className="h-3 w-3" /> no answer
    </span>
  ) : t.status === "unresolved" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      no verdict
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
      <XCircle className="h-3 w-3" /> {t.call_status ?? "error"}
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
        {guestCallChip(t.callback_state)}
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
  // Date and hour are two separate boxes; the EF gets them joined back into
  // its "YYYY-MM-DDTHH:mm" venue-local wall clock.
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
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

  // Live progress: while any ticket's run is still moving — intent loop
  // running OR the guest confirmation call in flight — poll. The interval
  // stops itself once every live ticket is stale (a crashed loop can leave
  // 'running' behind) — recency is checked in the callback, where Date.now()
  // is allowed.
  const isLive = (t: PlaygroundTicket) =>
    t.attempts_state === "running" ||
    t.callback_state === "calling" ||
    t.callback_state === "ringing";
  const hasRunning = tickets.some(isLive);
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(async () => {
      const r = await listPlaygroundReservations();
      if (!r.ok) return;
      setTickets(r.tickets);
      const stillLive = r.tickets.some(
        (t) =>
          (t.attempts_state === "running" ||
            t.callback_state === "calling" ||
            t.callback_state === "ringing") &&
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
    !!place && !!consumer && !!date && !!time && !!businessNumber && !!consumerNumber && !placing;

  async function onRun() {
    if (!place || !consumer) return;
    setPlacing(true);
    setRunError(null);
    setJustRan(false);
    try {
      const r = await createPlaygroundReservation({
        project_id: place.id,
        consumer_id: consumer.id,
        reserved_at: `${date}T${time}`,
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
          <span className="font-semibold">{config.attempts}</span>{" "}
          {config.attempts === 1 ? "call intent fires" : "call intents fire"}{" "}
          venue-ward (consumer → business, real ElevenLabs/Twilio spend) — no
          answer, next intent dials. When the venue{" "}
          <span className="font-semibold">confirms</span>, the agent then calls
          the guest (business → consumer) to confirm it to the human — and it
          hangs up on its own once each call&apos;s outcome is settled. Tickets
          stay in the playground sandbox, never in real consumer reservations.
        </p>
      </div>

      {/* ── The intent ── */}
      <SectionCard
        icon={<CalendarClock className="text-secondary h-4 w-4" />}
        title="The intent"
        subtitle="Pick one of each — real rows from the Mesita database — then the booking the fake user wants."
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
          <Labeled
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Date (venue local)"
          >
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Labeled>
          <div className="border-border bg-background rounded-xl border p-4">
            <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <CalendarClock className="h-3.5 w-3.5" />
              Hour
              {time && (
                <span className="text-secondary ml-auto font-semibold">
                  {TIME_SLOTS.find((s) => s.value === time)?.label ?? time}
                </span>
              )}
            </span>
            <div className="mt-3 grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4">
              {TIME_SLOTS.map((s) => {
                const active = time === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTime(s.value)}
                    className={
                      "rounded-lg border px-2 py-1.5 text-center text-xs font-medium tabular-nums transition " +
                      (active
                        ? "border-secondary bg-secondary/[0.08] text-secondary ring-secondary/30 ring-1"
                        : "border-border bg-card hover:border-foreground/30")
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
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
          <div className="lg:col-span-2">
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

      {/* ── Numbers ── */}
      <SectionCard
        icon={<Phone className="text-secondary h-4 w-4" />}
        title="Numbers"
        subtitle="Each side of the call can use its test line or the actual number from the database."
      >
        <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
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

      {/* ── Run ── */}
      <SectionCard
        icon={<PhoneCall className="text-secondary h-4 w-4" />}
        title="Run the intent"
        subtitle={`Creates the ticket immediately, then the ${config.attempts} intent${config.attempts === 1 ? " fires" : "s fire"} on their own — watch them land in the sandbox.`}
      >
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
          {businessNumber && (
            <span className="text-muted-foreground text-xs">
              Dials <span className="text-foreground font-mono">{businessNumber}</span>
              {consumerNumber && (
                <>
                  {" "}
                  · guest <span className="text-foreground font-mono">{consumerNumber}</span>
                </>
              )}
            </span>
          )}
        </div>

        {!canRun && !placing && (
          <p className="text-muted-foreground mt-3 text-xs">
            {!place
              ? "Pick a place."
              : !consumer
                ? "Pick a consumer."
                : !date
                  ? "Pick a date."
                  : !time
                    ? "Pick an hour."
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

      {/* ── Sandbox ── */}
      <SectionCard
        icon={<Inbox className="text-secondary h-4 w-4" />}
        title="Sandbox — playground tickets"
        subtitle="Every emulated reservation, remembered, with its intent-by-intent outcome. These live only in the playground."
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
