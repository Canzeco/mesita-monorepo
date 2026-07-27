"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Loader2,
  MessageSquareText,
  Phone,
  PhoneCall,
  Search,
  TriangleAlert,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { ErrorNote, SectionCard } from "../enricher-config/atlas-ui";
import {
  createPlaygroundReservation,
  listPlaygroundReservations,
  searchConsumerTargets,
  searchPlaceTargets,
  type ConsumerTarget,
  type NumberMode,
  type PlaceTarget,
  type PlaygroundTicket,
} from "./actions";
import { looksLikePhone, type ReservationsConfig } from "./catalog";

// Reservations Playground — FAKE USERS ONLY. The operator emulates a full
// reservation intent:
//
//   1. Pick a REAL place from the Mesita DB.
//   2. Pick a REAL consumer from the Mesita DB.
//   3. Author the intent (date & time, party size, special requests).
//   4. Choose each side's number: business = test line or the place's actual
//      endpoint; consumer = consumer test line or the consumer's actual phone.
//   5. Run it — a REAL Reservationist call goes out (ElevenLabs/Twilio spend).
//
// Every run creates a SANDBOX ticket in playground_reservations — never
// public.reservations, so nothing leaks into consumer apps — and the sandbox
// below remembers every ticket across sessions.

const inputCls =
  "border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-sm outline-none";

// Venue-local (Mexico City) formatting for sandbox tickets. Tickets store real
// instants; MX-City rendering shows the wall clock the venue was told.
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

// ── Target picker — one search box + dropdown over the real DB ───────────────

function TargetPicker<T extends { id: string; name: string; phone: string | null }>({
  icon,
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
  search,
  renderMeta,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  selected: T | null;
  onSelect: (t: T) => void;
  onClear: () => void;
  search: (q: string) => Promise<{ ok: true; results: T[] } | { ok: false; error: string }>;
  renderMeta?: (t: T) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // Debounced live search against the DB (also fires on focus with "" to browse).
  const run = useCallback(
    (q: string) => {
      const mine = ++seq.current;
      setBusy(true);
      setError(null);
      search(q)
        .then((r) => {
          if (seq.current !== mine) return;
          if (r.ok) setResults(r.results);
          else setError(r.error);
        })
        .finally(() => {
          if (seq.current === mine) setBusy(false);
        });
    },
    [search],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => run(query), 250);
    return () => clearTimeout(t);
  }, [query, open, run]);

  if (selected) {
    return (
      <div className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
        <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          {icon}
          {label}
        </span>
        <div className="border-border bg-card flex items-center gap-3 rounded-lg border px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{selected.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {renderMeta ? renderMeta(selected) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClear();
              setQuery("");
              setOpen(false);
            }}
            aria-label={`Clear ${label}`}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border bg-background relative flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        {icon}
        {label}
      </span>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        <input
          className={inputCls + " pl-8"}
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && (
        <div className="border-border bg-card absolute top-full right-4 left-4 z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border shadow-lg">
          {busy ? (
            <p className="text-muted-foreground flex items-center gap-2 px-3 py-2.5 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </p>
          ) : error ? (
            <p className="px-3 py-2.5 text-xs text-amber-600">{error}</p>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2.5 text-xs">
              No matches in the database.
            </p>
          ) : (
            results.map((t) => (
              <button
                key={t.id}
                type="button"
                // onMouseDown so the click wins over the input's onBlur close.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(t);
                  setOpen(false);
                }}
                className="hover:bg-muted/60 block w-full px-3 py-2 text-left"
              >
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="text-muted-foreground truncate font-mono text-[11px]">
                  {t.phone ?? "no phone"}
                </p>
              </button>
            ))
          )}
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

function TicketCard({ t }: { t: PlaygroundTicket }) {
  const placed = t.call_status === "placed";
  return (
    <li className="border-border bg-card rounded-2xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{t.place_name}</span>
        <span className="text-muted-foreground text-xs">for</span>
        <span className="text-sm font-medium">{t.consumer_name}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {placed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> call placed
            </span>
          ) : t.call_status ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              <XCircle className="h-3 w-3" /> {t.call_status}
            </span>
          ) : (
            <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-[10px] font-medium">
              no call
            </span>
          )}
        </span>
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
  const [when, setWhen] = useState("");
  const [party, setParty] = useState(2);
  const [notes, setNotes] = useState("");
  const [businessMode, setBusinessMode] = useState<NumberMode>("test");
  const [consumerMode, setConsumerMode] = useState<NumberMode>("test");

  const [placing, setPlacing] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastCall, setLastCall] = useState<
    | { ok: true; conversation_id: string | null; dialed: string }
    | { ok: false; error: string }
    | null
  >(null);

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
    setLastCall(null);
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
      setLastCall(r.call);
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
          <span className="font-semibold">Fake users only — but the call is real.</span>{" "}
          Running an intent places a live Reservationist call (ElevenLabs/Twilio
          spend) to whichever business number you choose below. Tickets land in the
          playground sandbox — never in real consumer reservations.
        </p>
      </div>

      {/* ── The intent ── */}
      <SectionCard
        icon={<CalendarClock className="text-secondary h-4 w-4" />}
        title="The intent"
        subtitle="Emulate a reservation: a real place, a real consumer — both from the Mesita database — and the booking the fake user wants."
      >
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <TargetPicker
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Place (from database)"
            placeholder="Search places by name…"
            selected={place}
            onSelect={(p) => setPlace(p)}
            onClear={() => setPlace(null)}
            search={searchPlaceTargets}
            renderMeta={(p) => (
              <>
                {p.address ? `${p.address} · ` : ""}
                <span className="font-mono">{p.phone ?? "no phone"}</span>
              </>
            )}
          />
          <TargetPicker
            icon={<User className="h-3.5 w-3.5" />}
            label="Consumer (from database)"
            placeholder="Search consumers by name or phone…"
            selected={consumer}
            onSelect={(c) => setConsumer(c)}
            onClear={() => setConsumer(null)}
            search={searchConsumerTargets}
            renderMeta={(c) => <span className="font-mono">{c.phone ?? "no phone"}</span>}
          />
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
            Actual business number selected — this run will ring{" "}
            <span className="font-semibold">{place.name}</span> on its real line (
            <span className="font-mono">{place.phone}</span>).
          </p>
        )}
      </SectionCard>

      {/* ── Run ── */}
      <SectionCard
        icon={<PhoneCall className="text-secondary h-4 w-4" />}
        title="Run the intent"
        subtitle="Creates a sandbox ticket and places the real call with the brief above."
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
                Placing call…
              </>
            ) : (
              <>
                <PhoneCall className="h-3.5 w-3.5" />
                Create ticket &amp; call
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
              ? "Pick a place from the database."
              : !consumer
                ? "Pick a consumer from the database."
                : !when
                  ? "Pick a date & time."
                  : !businessNumber
                    ? "No business number available — set the test number in Config."
                    : !consumerNumber
                      ? "No consumer number available — set the consumer test number in Config or pick a consumer with a phone."
                      : null}
          </p>
        )}

        {lastCall?.ok && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5 text-xs text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Call placed.</p>
              <p className="mt-0.5">
                Dialing <span className="font-mono">{lastCall.dialed}</span>
                {lastCall.conversation_id ? (
                  <>
                    {" "}
                    · conversation{" "}
                    <span className="font-mono break-all">{lastCall.conversation_id}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        )}
        {lastCall && !lastCall.ok && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3.5 text-xs text-red-700">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">Ticket created, call failed:</span>{" "}
              {lastCall.error}
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
        subtitle="Every emulated reservation, remembered. These live only in the playground — they never touch real consumer reservations."
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
