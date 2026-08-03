"use client";

import { useMemo } from "react";
import { CalendarCheck, Phone, PhoneCall, Users } from "lucide-react";
import type { PlaceActivity, PlaceReservation } from "../actions";
import { SectionCard } from "../ui";

// Performance → Reservations. READ-ONLY on purpose (Pato 2026-08-03):
// "reservations tickets cannot be directly edited. just must call the ai …
// just give the phone numbers to reschedule shit."
//
// So this panel renders no edit control of any kind. A booking's state is
// owned by the Reservationist — a1 dials the venue, a2 dials the guest, a3/a4
// answer inbound — and editing a row behind the agent's back would desync the
// conversation state it holds. The affordance we DO give is the two inbound
// numbers, as tel: links: call a3 (guest side) or a4 (venue side) and the
// agent does the reschedule properly.
//
// What's visualized: the status mix as a part-to-whole bar (one stacked bar
// beats six tiny pie charts), then each booking with the CALL LIFECYCLE that
// explains its state — attempts used, what the agent reported, the
// alternatives a venue offered, when the next retry fires.

// Reservation status → tone. Status colors are reserved and always ship with
// a text label, never color alone.
const STATUS: Record<string, { label: string; dot: string; chip: string }> = {
  pending: {
    label: "Pending",
    dot: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-700",
  },
  confirmed: {
    label: "Confirmed",
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-700",
  },
  declined: {
    label: "Declined",
    dot: "bg-rose-500",
    chip: "bg-rose-500/10 text-rose-700",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-foreground/25",
    chip: "bg-muted text-muted-foreground",
  },
  unreachable: {
    label: "Unreachable",
    dot: "bg-sky-500",
    chip: "bg-sky-500/10 text-sky-700",
  },
  unresolved: {
    label: "Unresolved",
    dot: "bg-indigo-500",
    chip: "bg-indigo-500/10 text-indigo-700",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-700",
  },
};

function statusOf(s: string | null) {
  return (
    STATUS[s ?? ""] ?? {
      label: s ?? "Unknown",
      dot: "bg-foreground/25",
      chip: "bg-muted text-muted-foreground",
    }
  );
}

// The agent's own verdict from a1_report_outcome — outranks the heuristic, so
// it's the honest "why" line when it exists.
const VERDICT_LABEL: Record<string, string> = {
  confirmed: "Venue accepted",
  counter_offer: "Venue offered alternatives",
  declined: "Venue said no",
  unreachable: "Never reached a person",
  wrong_number: "Answered — wrong place",
};

function when(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function telHref(n: string): string {
  return `tel:${n.replace(/[^\d+]/g, "")}`;
}

/** The two inbound AI lines — the only supported way to change a booking. */
function LineButton({
  label,
  who,
  number,
}: {
  label: string;
  who: string;
  number: string;
}) {
  return (
    <a
      href={telHref(number)}
      className="border-border bg-background hover:border-foreground/30 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border p-3 transition"
    >
      <span className="bg-secondary/10 text-secondary inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <PhoneCall className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{number}</span>
        <span className="text-muted-foreground block truncate text-[11px]">
          {label} · {who}
        </span>
      </span>
    </a>
  );
}

/** Status mix as one part-to-whole bar — reads at a glance, no pie. */
function StatusBar({ rows }: { rows: PlaceReservation[] }) {
  const mix = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of rows) {
      const k = r.status ?? "unknown";
      by.set(k, (by.get(k) ?? 0) + 1);
    }
    return [...by.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="mt-4">
      {/* 2px surface gaps between segments so adjacent fills stay separable. */}
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
        {mix.map(([key, n]) => (
          <span
            key={key}
            className={statusOf(key).dot}
            style={{ width: `${(n / rows.length) * 100}%` }}
            title={`${statusOf(key).label}: ${n}`}
          />
        ))}
      </div>
      {/* Legend carries the label — identity is never color alone. */}
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
        {mix.map(([key, n]) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px]">
            <span className={"h-2 w-2 shrink-0 rounded-full " + statusOf(key).dot} />
            <span className="text-muted-foreground">
              {statusOf(key).label} · <span className="tabular-nums">{n}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function alternativesText(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const parts = v
    .map((a) => {
      if (typeof a === "string") return a;
      if (a && typeof a === "object") {
        const o = a as Record<string, unknown>;
        const at = typeof o.reserved_at === "string" ? when(o.reserved_at) : null;
        const size = typeof o.party_size === "number" ? `${o.party_size}p` : null;
        return [at, size].filter(Boolean).join(" · ") || null;
      }
      return null;
    })
    .filter((x): x is string => !!x);
  return parts.length > 0 ? parts.join("  |  ") : null;
}

function Row({ r }: { r: PlaceReservation }) {
  const st = statusOf(r.status);
  const verdict = r.call.verdict ? VERDICT_LABEL[r.call.verdict] ?? r.call.verdict : null;
  const alts = alternativesText(r.call.alternatives);

  return (
    <div className="border-border bg-background rounded-xl border p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarCheck className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{when(r.reservedAt)}</span>
            {r.partySize != null && (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                <Users className="h-3 w-3" />
                {r.partySize}
              </span>
            )}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {r.guest}
            {r.referenceCode ? ` · ${r.referenceCode}` : ""}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {r.isTest && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
              Test
            </span>
          )}
          <span
            className={"rounded-full px-2 py-0.5 text-[11px] font-semibold " + st.chip}
          >
            {st.label}
          </span>
        </span>
      </div>

      {/* The call lifecycle — why this booking is where it is. */}
      <div className="text-muted-foreground mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3 w-3" />
          {r.call.attempts}
          {r.call.attemptsPlanned ? `/${r.call.attemptsPlanned}` : ""} call
          {r.call.attempts === 1 ? "" : "s"}
        </span>
        {r.call.state && <span>state: {r.call.state}</span>}
        {r.call.lastStatus && <span>last: {r.call.lastStatus}</span>}
        {r.call.negotiationRounds > 0 && (
          <span>{r.call.negotiationRounds} negotiation round(s)</span>
        )}
        {r.call.nextAttemptAt && <span>retry {when(r.call.nextAttemptAt)}</span>}
        {r.call.callbackState && <span>callback: {r.call.callbackState}</span>}
      </div>

      {verdict && (
        <p className="text-foreground/80 mt-2 text-xs">
          <span className="font-medium">Agent reported:</span> {verdict}
        </p>
      )}
      {alts && (
        <p className="text-muted-foreground mt-1 text-xs">
          <span className="font-medium">Alternatives offered:</span> {alts}
        </p>
      )}
      {r.call.outcomeNote && (
        <p className="text-muted-foreground mt-1 text-xs italic">
          “{r.call.outcomeNote}”
        </p>
      )}
      {r.notes && (
        <p className="text-muted-foreground mt-1 text-xs">
          <span className="font-medium">Guest note:</span> {r.notes}
        </p>
      )}
    </div>
  );
}

export function ReservationsPanel({ activity }: { activity: PlaceActivity }) {
  const rows = activity.reservations;

  return (
    <SectionCard
      icon={<CalendarCheck className="h-4 w-4" />}
      tint="amber"
      title="Reservations"
      subtitle="Bookings and the Reservationist call that produced them. Read-only — a booking is changed by calling the AI, never by editing it here."
    >
      {/* The affordance, stated before the list so it reads as the answer to
          "how do I change one?" */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <LineButton label="Guests" who="a3 answers" number={activity.lines.guest} />
        <LineButton label="Venues" who="a4 answers" number={activity.lines.venue} />
      </div>
      <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
        To reschedule or cancel, call the line for that side — the agent holds the
        conversation state, so editing the row directly would desync it.
        {activity.lines.guest === activity.lines.venue
          ? " Both sides currently share one line (ELEVENLABS_CONSUMER_FROM_NUMBER unset)."
          : ""}
      </p>

      <StatusBar rows={rows} />

      <div className="mt-4 flex flex-col gap-2">
        {rows.map((r) => (
          <Row key={r.id} r={r} />
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground px-1 text-xs leading-relaxed">
            No reservations for this place yet.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
