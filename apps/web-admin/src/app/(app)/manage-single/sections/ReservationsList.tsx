"use client";

import { PhoneCall } from "lucide-react";
import type { PlaceActivity } from "../actions";

// Performance → Mesita Reservationist bookings, as a plain list
// (MESITA-900). Scope is Mesita only — not Google Reserve / OpenTable.
//
// READ-ONLY, and that is the product decision, not a shortcut (Pato):
// "reservations tickets cannot be directly edited. just must call the ai …
// just give the phone numbers to reschedule shit." The Reservationist holds
// conversation state across call legs, so editing a row behind it would
// desync the agent from its own booking. The call bar therefore leads the
// card and there is no edit control anywhere in it.
//
// Named ReservationsList, not ReservationsPanel: `ReservationsCard` already
// exists on the Controls tab for channel routing, and two files a letter
// apart is how the wrong one gets imported.

const STATUS: Record<string, { label: string; chip: string }> = {
  pending: { label: "Pending", chip: "bg-amber-500/10 text-amber-700" },
  confirmed: { label: "Confirmed", chip: "bg-emerald-500/10 text-emerald-700" },
  completed: { label: "Completed", chip: "bg-emerald-500/10 text-emerald-700" },
  declined: { label: "Declined", chip: "bg-rose-500/10 text-rose-700" },
  cancelled: { label: "Cancelled", chip: "bg-muted text-muted-foreground" },
  unreachable: { label: "Unreachable", chip: "bg-sky-500/10 text-sky-700" },
  unresolved: { label: "Unresolved", chip: "bg-indigo-500/10 text-indigo-700" },
};

function statusOf(s: string | null) {
  return STATUS[s ?? ""] ?? { label: s ?? "—", chip: "bg-muted text-muted-foreground" };
}

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

function tel(n: string): string {
  return `tel:${n.replace(/[^\d+]/g, "")}`;
}

function LineLink({ number, who }: { number: string; who: string }) {
  return (
    <a
      href={tel(number)}
      className="border-border bg-background hover:border-foreground/30 flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 transition"
    >
      <PhoneCall className="text-secondary h-4 w-4 shrink-0" />
      <span className="text-sm font-semibold">{number}</span>
      <span className="text-muted-foreground truncate text-xs">{who}</span>
    </a>
  );
}

export function ReservationsList({ activity }: { activity: PlaceActivity }) {
  const rows = activity.reservations;
  // Both audiences share one number until ELEVENLABS_CONSUMER_FROM_NUMBER is
  // set; rendering it twice would read as a bug rather than as a fact.
  const shared = activity.lines.guest === activity.lines.place;

  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold tracking-tight">
        Reservations
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Mesita bookings only. Read-only — call the AI to reschedule or cancel.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {shared ? (
          <LineLink
            number={activity.lines.guest}
            who="Guests & places · one shared line"
          />
        ) : (
          <>
            <LineLink number={activity.lines.guest} who="Guests" />
            <LineLink number={activity.lines.place} who="Places" />
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground border-border mt-4 rounded-xl border border-dashed px-4 py-7 text-center text-sm">
          No reservations for this place yet.
        </p>
      ) : (
        <>
          <div className="mt-4">
            {rows.map((r) => {
              const st = statusOf(r.status);
              return (
                <div
                  key={r.id}
                  className="border-border flex items-center gap-3 border-t py-2.5 text-sm first:border-t-0"
                >
                  <span className="w-32 shrink-0 font-medium sm:w-40">
                    {when(r.reservedAt)}
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate">
                    {r.guest}
                    {r.partySize != null
                      ? ` · ${r.partySize} guest${r.partySize === 1 ? "" : "s"}`
                      : ""}
                    {r.isTest ? " · test" : ""}
                  </span>
                  <span
                    className={
                      "shrink-0 rounded-full px-2.5 py-0.5 type-label font-semibold " +
                      st.chip
                    }
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Showing {rows.length} of {activity.reservationTotal} · newest first
          </p>
        </>
      )}
    </section>
  );
}
