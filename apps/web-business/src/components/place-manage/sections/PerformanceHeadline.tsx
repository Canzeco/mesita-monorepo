"use client";

import type { PlaceStats } from "../actions";
import { formatPesosCompact } from "@/lib/format";

// Performance → the answer card. Everything else on the tab supports this.
//
// Pato's brief: "make the performance page simpler by far. remove lots of
// stuff … just focus on the simple important stuff to know." The page answers
// ONE question, so this card states it and answers it: three money numbers,
// then the Saved → Visited → Closed funnel with the two conversions that say
// whether Mesita is actually producing visits and closes.
//
// Numbers come from real aggregates (admin-web-get-place-activity → stats),
// never from a page of the event feed — see that EF's header for why.
//
// Funnel form: one narrowing quantity, so Saved and Visited share ONE hue
// (two different blues would imply a rank difference that isn't there) and
// Closed is emphasized because it is the step that matters. Every bar carries
// its number as a text label, so hue is never the only channel.

function mxn(cents: number | null): string {
  if (cents == null || cents <= 0) return "—";
  return formatPesosCompact(cents);
}

function count(n: number): string {
  return n.toLocaleString();
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  const empty = value === "—";
  return (
    <div className="border-border bg-muted/40 min-w-[11rem] flex-1 snap-start rounded-xl border px-4 py-3.5 sm:min-w-[12.5rem]">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      {/* Proportional figures: tabular-nums is for columns of numbers and
          makes a display value look loose. */}
      <p
        className={
          "mt-2 text-4xl leading-none font-semibold tracking-tight " +
          (empty ? "text-muted-foreground" : "text-foreground")
        }
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>
    </div>
  );
}

function Step({
  label,
  value,
  pct,
  note,
  emphasis,
}: {
  label: string;
  value: number;
  /** Bar width as a share of the funnel's first step. */
  pct: number;
  note: string | null;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <span className="text-muted-foreground w-16 shrink-0 text-xs sm:w-24 sm:text-sm">
        {label}
      </span>
      <span className="bg-muted relative h-8 flex-1 overflow-hidden rounded-lg">
        <span
          className={
            "flex h-full items-center rounded-lg pl-3 text-sm font-semibold text-white " +
            (emphasis ? "bg-emerald-600" : "bg-indigo-600")
          }
          style={{ width: `${Math.max(pct, value > 0 ? 8 : 0)}%` }}
        >
          {value > 0 ? count(value) : ""}
        </span>
        {value === 0 && (
          <span className="text-muted-foreground absolute inset-y-0 left-3 flex items-center text-sm">
            0
          </span>
        )}
      </span>
      <span className="text-muted-foreground w-20 shrink-0 text-right type-label sm:w-28 sm:text-xs">
        {note ?? ""}
      </span>
    </div>
  );
}

export function PerformanceHeadline({ stats }: { stats: PlaceStats }) {
  const anyActivity =
    stats.saves > 0 || stats.visits > 0 || stats.closed > 0 || stats.tickets > 0;
  const top = Math.max(stats.saves, stats.visits, stats.closed, 1);
  const discountShare =
    stats.influencedCents > 0
      ? Math.round((stats.discountCents / stats.influencedCents) * 100)
      : null;

  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-muted-foreground type-label font-semibold tracking-[0.12em] uppercase">
          Is Mesita working here?
        </h2>
        <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 type-label">
          all time
        </span>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none">
        <Figure
          label="Influenced spend"
          value={mxn(stats.influencedCents)}
          hint={
            stats.billedCount > 0
              ? `over ${count(stats.billedCount)} recorded bill${stats.billedCount === 1 ? "" : "s"}`
              : stats.closed > 0
              ? `across ${count(stats.closed)} closed visit${stats.closed === 1 ? "" : "s"} (no bills yet)`
              : "no closed visits yet"
          }
        />
        <Figure
          label="Avg ticket"
          value={mxn(stats.avgTicketCents)}
          hint={
            stats.consumerReportedCount > 0
              ? `${count(stats.consumerReportedCount)} typed by the guest`
              : "per closed visit with a bill"
          }
        />
        <Figure
          label="Discount funded"
          value={mxn(stats.discountCents)}
          hint={
            discountShare != null
              ? `${discountShare}% of influenced spend`
              : "of influenced spend"
          }
        />
      </div>

      <div className="border-border mt-6 border-t pt-5">
        {anyActivity ? (
          <div className="flex flex-col gap-3">
            <Step
              label="Saved"
              value={stats.saves}
              pct={(stats.saves / top) * 100}
              note={null}
            />
            <Step
              label="Visited"
              value={stats.visits}
              pct={(stats.visits / top) * 100}
              note={stats.visitRate != null ? `${stats.visitRate}% of saves` : null}
            />
            <Step
              label="Closed"
              value={stats.closed}
              pct={(stats.closed / top) * 100}
              note={stats.closeRate != null ? `${stats.closeRate}% of visits` : null}
              emphasis
            />
          </div>
        ) : (
          <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-7 text-center text-sm">
            No guest activity yet. Saves, visits and closed visits appear here as they
            happen.
          </p>
        )}
      </div>
    </section>
  );
}
