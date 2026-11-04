"use client";

// The log (MESITA-3202), newest first. No visit is registered from this app
// (MESITA-3226), so this page only reads and voids.

import { useState } from "react";
import { Card } from "@/components/shell/Page";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { listPlaceVisits, voidPlaceVisit, type PlaceVisit, type PlaceVisits } from "@/lib/business-api";
import { money, PAYMENT_LABEL, REWARD_COPY } from "@/lib/rewards";
import { cn } from "@/lib/utils";

const ROW = "flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6";
const QUIET =
  "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40";

function when(iso: string, timezone: string | null): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  try {
    return d.toLocaleString("en-US", { ...opts, ...(timezone ? { timeZone: timezone } : {}) });
  } catch {
    return d.toLocaleString("en-US", opts);
  }
}

function VisitRow({
  visit,
  timezone,
  canVoid,
  busy,
  onVoid,
}: {
  visit: PlaceVisit;
  timezone: string | null;
  canVoid: boolean;
  busy: boolean;
  onVoid: () => void;
}) {
  const voided = !!visit.voided_at;
  const reward = visit.reward_kinds.length
    ? `${visit.reward_kinds.map((k) => REWARD_COPY[k].name).join(" + ")} −${money(visit.discount_cents, visit.currency)}`
    : null;
  const facts = [
    `Paid ${money(visit.total_cents, visit.currency)}`,
    visit.payment_method ? PAYMENT_LABEL[visit.payment_method] : null,
    reward,
    when(visit.created_at, timezone),
  ].filter(Boolean);
  return (
    <li className={cn(ROW, voided && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {visit.guest_name ?? "Guest"}
          {voided ? <span className="text-muted-foreground font-normal"> · Voided</span> : null}
        </p>
        <p className="text-muted-foreground">{facts.join(" · ")}</p>
      </div>
      {canVoid && !voided ? (
        <button type="button" className={QUIET} disabled={busy} onClick={onVoid}>
          Void
        </button>
      ) : null}
    </li>
  );
}

export function VisitsPanel({ placeId, initial }: { placeId: string; initial: PlaceVisits }) {
  const [visits, setVisits] = useState<PlaceVisit[]>(initial.visits);
  const [next, setNext] = useState<string | null>(initial.next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!next) return;
    setBusy(true);
    setError(null);
    const r = await listPlaceVisits(placeId, next);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setVisits((v) => [...v, ...r.data.visits]);
    setNext(r.data.next);
  }

  async function voidOne(visit: PlaceVisit) {
    if (!window.confirm(`Void ${visit.guest_name ?? "this guest"}'s visit? It stays in the list, marked Voided.`)) return;
    setBusy(true);
    setError(null);
    const r = await voidPlaceVisit(placeId, visit.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setVisits((all) => all.map((v) => (v.id === visit.id ? { ...v, voided_at: r.data.voided_at } : v)));
  }

  return (
    <>
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">
          {visits.length === 0 ? <li className={cn(ROW, "text-muted-foreground")}>No visits yet.</li> : null}
          {visits.map((v) => (
            <VisitRow
              key={v.id}
              visit={v}
              timezone={initial.timezone}
              canVoid={initial.can_void}
              busy={busy}
              onVoid={() => void voidOne(v)}
            />
          ))}
          {next ? (
            <li className={ROW}>
              <button type="button" className={QUIET} disabled={busy} onClick={() => void more()}>
                {busy ? "Loading…" : "Show more"}
              </button>
            </li>
          ) : null}
        </ul>
        {error ? <p className={cn(ERROR_BOX_CLASS, "mx-5 mb-4 sm:mx-6")}>{error}</p> : null}
      </Card>
    </>
  );
}
