"use client";

import type { PlaceReservations } from "@/lib/api/reservations";

// Business Reservations tab — Mesita bookings only (MESITA-894).
// Mirrors admin ReservationsList: read-only list. The reservation line moved
// to the per-place Settings tab as passive info (MESITA-897).

const STATUS: Record<string, { label: string; chip: string }> = {
  pending: { label: "Pending", chip: "bg-amber-500/10 text-amber-700" },
  confirmed: { label: "Confirmed", chip: "bg-emerald-500/10 text-emerald-700" },
  completed: { label: "Completed", chip: "bg-emerald-500/10 text-emerald-700" },
  declined: { label: "Declined", chip: "bg-rose-500/10 text-rose-700" },
  cancelled: { label: "Cancelled", chip: "bg-muted text-muted-foreground" },
  unreachable: { label: "Unreachable", chip: "bg-sky-500/10 text-sky-700" },
  unresolved: { label: "Unresolved", chip: "bg-indigo-500/10 text-indigo-700" },
  no_show: { label: "No-show", chip: "bg-rose-500/10 text-rose-700" },
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

export function ReservationsClient({ data }: { data: PlaceReservations }) {
  const rows = data.reservations;

  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold tracking-tight">
        Reservations
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Mesita bookings only. Read-only — call the AI to reschedule or cancel.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground border-border mt-4 rounded-xl border border-dashed px-4 py-7 text-center text-sm">
          No Mesita reservations for this place yet.
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
                      "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold " +
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
            Showing {rows.length} of {data.reservationTotal} · newest first
          </p>
        </>
      )}
    </section>
  );
}
