"use client";

// Waiter Codes (MESITA-4871, Pato: "add a section to add waiter codes … different
// codes for different waiters in order to appropriately direct the tip"). One
// 8-digit code per waiter, made by Mesita, shown once, only a hash kept. A bill
// carries the waiter whose code sent it, so the table says whose tips are whose.
// Instant, not under Save changes: these are actions. The server refuses editors.

import { useState } from "react";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { setWaiter, type PlaceWaiter } from "@/lib/business-api";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const QUIET = "border-border hover:bg-muted h-9 rounded-full border px-3 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-40";
const CELL = "px-3 py-2.5 whitespace-nowrap first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6";

export function WaiterCodes({
  placeId,
  initial,
  currency,
  canEdit,
  onError,
}: {
  placeId: string;
  initial: PlaceWaiter[];
  currency: string;
  canEdit: boolean;
  onError: (error: string | null) => void;
}) {
  const [waiters, setWaiters] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [made, setMade] = useState<{ id: string; name: string; code: string } | null>(null);

  async function run(key: string, body: Parameters<typeof setWaiter>[1]) {
    if (busy) return null;
    setBusy(key);
    onError(null);
    const r = await setWaiter(placeId, body);
    setBusy(null);
    if (!r.ok) {
      onError(r.error);
      return null;
    }
    if (r.data.code) setMade({ id: r.data.waiter_id, name: r.data.name, code: r.data.code });
    return r.data;
  }

  async function add() {
    const r = await run("add", { action: "add", name });
    if (!r) return;
    setName("");
    setWaiters((ws) =>
      [...ws, { id: r.waiter_id, name: r.name, removed: false, tips_24h_cents: 0, bills_24h: 0, tips_7d_cents: 0, bills_7d: 0 }].sort(
        (a, b) => Number(a.removed) - Number(b.removed) || a.name.localeCompare(b.name),
      ),
    );
  }

  async function remove(w: PlaceWaiter) {
    if (!window.confirm(`Remove ${w.name}? Their code stops working now.`)) return;
    if (!(await run(w.id, { action: "remove", waiter_id: w.id }))) return;
    setMade((c) => (c?.id === w.id ? null : c));
    setWaiters((ws) => (w.bills_7d > 0 ? ws.map((x) => (x.id === w.id ? { ...x, removed: true } : x)) : ws.filter((x) => x.id !== w.id)));
  }

  const tips = (cents: number, bills: number) =>
    bills > 0 ? (
      <>
        <span className="font-semibold">{moneyLabel(cents, currency)}</span> <span className="text-muted-foreground">· {bills}</span>
      </>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  return (
    <div className="text-sm" data-waiter-codes>
      <p className="text-muted-foreground px-5 pb-3 sm:px-6">
        One 8-digit code per waiter. They scan the guest&apos;s QR and type their code to send the bill, so you know whose tip it is.
      </p>
      {made ? (
        <div className="border-border bg-muted/50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-5 py-4 sm:px-6" role="status">
          <div className="min-w-0">
            <p className="font-medium">{made.name}&apos;s code</p>
            <p className="text-muted-foreground">Give it to them now. It won&apos;t be shown again.</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-2xl font-semibold tracking-widest whitespace-nowrap tabular-nums">
              {made.code.slice(0, 4)} {made.code.slice(4)}
            </p>
            <button type="button" className={QUIET} onClick={() => setMade(null)}>
              Done
            </button>
          </div>
        </div>
      ) : null}
      {waiters.length > 0 ? (
        <div className="border-border overflow-x-auto border-t [scrollbar-width:thin]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-xs">
                <th scope="col" className={cn(CELL, "text-left font-semibold")}>Waiter</th>
                <th scope="col" className={cn(CELL, "text-right font-semibold")}>Tips, 24 hours · bills</th>
                <th scope="col" className={cn(CELL, "text-right font-semibold")}>Tips, 7 days · bills</th>
                {canEdit ? <th scope="col" className={CELL} aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {waiters.map((w) => (
                <tr key={w.id}>
                  <th scope="row" className={cn(CELL, "text-left font-medium", w.removed && "text-muted-foreground")}>
                    {w.name}
                    {w.removed ? <span className="font-normal"> · Removed</span> : null}
                  </th>
                  <td className={cn(CELL, "text-right tabular-nums")}>{tips(w.tips_24h_cents, w.bills_24h)}</td>
                  <td className={cn(CELL, "text-right tabular-nums")}>{tips(w.tips_7d_cents, w.bills_7d)}</td>
                  {canEdit ? (
                    <td className={CELL}>
                      {w.removed ? null : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className={QUIET}
                            disabled={busy !== null}
                            onClick={() => {
                              if (window.confirm(`Make a new code for ${w.name}? The old one stops working.`)) void run(w.id, { action: "new_code", waiter_id: w.id });
                            }}
                          >
                            New code
                          </button>
                          <button type="button" className={QUIET} disabled={busy !== null} onClick={() => void remove(w)}>
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {waiters.every((w) => w.removed) ? (
        <p className="text-muted-foreground border-border border-t px-5 py-3 sm:px-6">No waiter codes yet. Without one, nobody can send bills.</p>
      ) : null}
      {canEdit ? (
        <form
          className="border-border flex items-center gap-2 border-t px-5 py-3 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void add();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Waiter's name"
            aria-label="Waiter's name"
            autoComplete="off"
            className="border-border bg-background h-10 min-w-0 flex-1 rounded-full border px-4"
          />
          <button type="submit" className={cn(PILL_BUTTON_CLASS, "shrink-0 whitespace-nowrap")} disabled={busy !== null || !name.trim()}>
            {busy === "add" ? "Adding…" : "Add waiter"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
