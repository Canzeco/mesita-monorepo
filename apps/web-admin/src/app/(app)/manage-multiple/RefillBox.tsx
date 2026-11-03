"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { endMesitaDays, refillPlaces, type RefillLine } from "./actions";
import { parseGooglePlaceIds } from "./google-place-ids";
import { IdListField } from "./IdListField";
import { StateIcon } from "./StateIcon";

// Manage Multiple › Boost (MESITA-3163; Boost since MESITA-3175, box 5 since
// MESITA-3188): a Boost of Premier 2X or 5X for N days,
// for every pasted Google Place ID. 5X days run before 2X days; a place
// whose paid Subscription is higher is refused. One call for the box; a
// line the reply does not carry reads unknown, and Retry unfinished resends
// the unknown and refused lines with the SAME requestId, so a press that
// timed out never adds days twice. Every new press makes a new requestId.

type Run =
  | { action: "refill"; tier: 1 | 2; days: number; requestId: string }
  | { action: "end" };

type Line = RefillLine | { googlePlaceId: string; result: "unknown"; error?: string };

const REFUSED: Record<string, string> = {
  not_found: "Not on Mesita",
  archived: "Archived — not boosted",
  unlisted: "Disabled — enable it first",
  paid_higher: "Its paid Subscription is higher",
  cap_reached: "Over 366 queued days",
  tier_invalid: "Tier must be 2X or 5X",
  days_invalid: "Days must be 1 to 366",
};

const MAX_DAYS = 366;

function day(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function detail(line: Line, run: Run | null): { text: string; error?: boolean } {
  if (line.result === "unknown") {
    return { text: ("error" in line && line.error) || "No answer — Retry unfinished", error: true };
  }
  if (line.result === "refused") return { text: REFUSED[line.code ?? ""] ?? line.code ?? "Refused", error: true };
  const ends = [
    day(line.ends_at_5x) ? `5X until ${day(line.ends_at_5x)}` : null,
    day(line.ends_at_2x) ? `2X until ${day(line.ends_at_2x)}` : null,
  ].filter(Boolean).join(" · ");
  if (run?.action === "end") {
    const n = line.ended_days ?? 0;
    return { text: `Ended ${n} day${n === 1 ? "" : "s"}${ends ? ` · ${ends} left` : ""}` };
  }
  return { text: `${line.replayed ? "Already added · " : ""}${ends || "Added"}` };
}

export function RefillBox({
  id,
  text,
  onTextChange,
}: {
  id: string;
  text: string;
  onTextChange: (next: string) => void;
}) {
  const placeIds = useMemo(() => parseGooglePlaceIds(text), [text]);
  const [tier, setTier] = useState<1 | 2>(1);
  const [daysText, setDaysText] = useState("30");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [running, setRunning] = useState<Run["action"] | null>(null);
  const busy = running !== null;

  const days = Number(daysText);
  const daysOk = Number.isInteger(days) && days >= 1 && days <= MAX_DAYS;
  const unfinished = placeIds.filter((g) => {
    const r = lines[g]?.result;
    return r === "unknown" || r === "refused";
  });
  const okCount = placeIds.filter((g) => lines[g]?.result === "ok").length;
  const refusedCount = placeIds.filter((g) => lines[g]?.result === "refused").length;
  const unknownCount = placeIds.filter((g) => lines[g]?.result === "unknown").length;

  async function send(run: Run, ids: string[]) {
    if (busy || ids.length === 0) return;
    setRunning(run.action);
    setLastRun(run);
    setLines((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((g) => [g, { googlePlaceId: g, result: "unknown" as const, error: "Running…" }])),
    }));
    try {
      const r = run.action === "refill"
        ? await refillPlaces({ googlePlaceIds: ids, tier: run.tier, days: run.days, requestId: run.requestId })
        : await endMesitaDays(ids);
      const answered = r.ok ? new Map(r.data.map((l) => [l.googlePlaceId, l])) : new Map<string, RefillLine>();
      const error = r.ok ? undefined : r.error;
      setLines((prev) => ({
        ...prev,
        ...Object.fromEntries(ids.map((g): [string, Line] => [g, answered.get(g) ?? { googlePlaceId: g, result: "unknown", error }])),
      }));
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unexpected error";
      setLines((prev) => ({
        ...prev,
        ...Object.fromEntries(ids.map((g): [string, Line] => [g, { googlePlaceId: g, result: "unknown", error }])),
      }));
    } finally {
      setRunning(null);
    }
  }

  function pressRefill() {
    if (!daysOk) return;
    setLines({});
    void send({ action: "refill", tier, days, requestId: crypto.randomUUID() }, [...placeIds]);
  }

  function pressEnd() {
    const n = placeIds.length;
    if (!window.confirm(`End Mesita Boost on ${n} place${n === 1 ? "" : "s"}? Bought Boosts stay.`)) return;
    setLines({});
    void send({ action: "end" }, [...placeIds]);
  }

  return (
    <div className="space-y-6">
      <IdListField
        id={`${id}-place-ids`}
        label="Google Place IDs"
        text={text}
        onTextChange={onTextChange}
        placeIds={placeIds}
        running={busy}
      />

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="text-sm font-medium">Premier</span>
          <div className="border-border mt-2 inline-flex rounded-full border p-0.5">
            {([1, 2] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={busy}
                onClick={() => setTier(t)}
                aria-pressed={tier === t}
                className={`h-9 rounded-full px-4 text-sm font-medium disabled:opacity-50 ${
                  tier === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === 1 ? "Premier 2X" : "Premier 5X"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor={`${id}-days`}>
            Days
          </label>
          <input
            id={`${id}-days`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_DAYS}
            value={daysText}
            disabled={busy}
            onChange={(e) => setDaysText(e.target.value)}
            className="border-border bg-background focus:border-foreground mt-2 block h-10 w-28 rounded-xl border px-3 text-sm tabular-nums outline-none disabled:opacity-50"
          />
        </div>
      </div>
      {!daysOk ? <p className="text-destructive type-label">Days must be a whole number from 1 to {MAX_DAYS}.</p> : null}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <BoxButton
            label="Boost"
            primary
            busy={running === "refill"}
            disabled={busy || placeIds.length === 0 || !daysOk}
            onClick={pressRefill}
          />
          <BoxButton
            label="End Mesita Boost"
            busy={running === "end"}
            disabled={busy || placeIds.length === 0}
            onClick={pressEnd}
          />
          {lastRun && unfinished.length > 0 && !busy ? (
            <button
              type="button"
              onClick={() => void send(lastRun, unfinished)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-2"
            >
              <RotateCcw className="h-3 w-3" />
              Retry unfinished ({unfinished.length})
            </button>
          ) : null}
          {lastRun && !busy && Object.keys(lines).length > 0 ? (
            <span className="text-muted-foreground text-xs">
              {okCount} {lastRun.action === "end" ? "ended" : "boosted"} · {refusedCount} refused · {unknownCount} unknown
            </span>
          ) : null}
        </div>
        {Object.keys(lines).length > 0 ? (
          <div className="border-border bg-card mt-3 overflow-hidden rounded-2xl border">
            <ul className="divide-border/60 divide-y">
              {placeIds.map((g) => {
                const line = lines[g];
                if (!line) return null;
                const pending = busy && line.result === "unknown" && "error" in line && line.error === "Running…";
                const d = detail(line, lastRun);
                return (
                  <li key={g} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <StateIcon state={pending ? "running" : line.result === "ok" ? "ok" : line.result === "refused" ? "refused" : "error"} />
                    <div className="min-w-0 flex-1">
                      <span className="text-muted-foreground font-mono text-xs">{g}</span>
                      {pending ? null : (
                        <p className={d.error ? "text-destructive type-label" : "text-muted-foreground type-label"}>{d.text}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BoxButton({
  label,
  primary,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  primary?: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? "bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
          : "border-border hover:border-foreground/40 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50"
      }
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
