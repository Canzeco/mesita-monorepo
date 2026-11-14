"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CoinsIcon, GaugeIcon } from "@phosphor-icons/react";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { Button, SectionCard } from "@/components/admin-ui/config";
import { businessPlaceHref } from "@/lib/business-url";
import { saveDefaultLimit, savePlaceLimit, type LimitDefault, type LimitPlace } from "./actions";

/** Pato's watch line: a place at 80% of its limit or more is highlighted. */
const WATCH_PCT = 80;

/** Whole units the operator types ("100,000") → cents; null = not a limit. */
export function unitsToCents(raw: string): number | null {
  const body = raw.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(body)) return null;
  const n = Number(body) * 100;
  return Number.isSafeInteger(n) ? n : null;
}

const units = (cents: number) => Math.round(cents / 100).toLocaleString("en-US");

/** % of the limit used; Infinity when credit is owed against a 0 or missing limit. */
export function usedPct(outstanding: number, limit: number | null): number {
  if (!limit) return outstanding > 0 ? Infinity : 0;
  return (outstanding / limit) * 100;
}

const pctText = (pct: number) => (pct === Infinity ? "Over" : `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`);

/** One limit: a whole-units input and Save; a place also gets Use default. */
function LimitEditor({
  cents,
  currency,
  onSave,
  onClear,
  placeholder,
}: {
  cents: number | null;
  currency: string;
  onSave: (cents: number) => Promise<string | null>;
  onClear?: () => Promise<string | null>;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(cents === null ? "" : units(cents));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const parsed = unitsToCents(draft);
  const dirty = draft.trim() !== "" && parsed !== null && parsed !== cents;

  const run = (fn: () => Promise<string | null>) =>
    start(async () => {
      setError(await fn());
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <span className="text-muted-foreground text-xs">{currency}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          placeholder={placeholder}
          aria-label={`Limit in ${currency}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty && parsed !== null) run(() => onSave(parsed));
          }}
          className="border-border bg-card focus:border-foreground h-9 w-36 rounded-lg border px-3 text-right text-sm tabular-nums outline-none"
        />
        <Button size="sm" pending={pending} disabled={!dirty} onClick={() => parsed !== null && run(() => onSave(parsed))}>
          Save
        </Button>
        {onClear && cents !== null ? (
          <Button size="sm" tone="secondary" pending={pending} onClick={() => run(onClear)}>
            Use default
          </Button>
        ) : null}
      </div>
      {error ? (
        <span className="text-destructive text-xs" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function CreditsLimitPanel({
  testMode,
  defaults,
  places,
}: {
  testMode: boolean;
  defaults: LimitDefault[];
  places: LimitPlace[];
}) {
  const router = useRouter();
  const after = (r: { ok: true } | { ok: false; error: string }) => {
    if (!r.ok) return r.error;
    router.refresh();
    return null;
  };
  const defaultFor = new Map(defaults.map((d) => [d.currency, d.limit_cents]));
  const rows = places
    .map((p) => ({ ...p, pct: usedPct(p.outstanding_cents, p.limit_cents) }))
    .sort((a, b) => b.pct - a.pct || b.outstanding_cents - a.outstanding_cents);
  const watched = rows.filter((r) => r.pct >= WATCH_PCT).length;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        icon={<GaugeIcon className="h-5 w-5" aria-hidden />}
        title="Places"
        subtitle={`Every place holding credit or with House Credits on, most used first. Outstanding is Available plus Pending, every guest, plus unclaimed gifts. ${WATCH_PCT}% and over is highlighted.${testMode ? " Test mode: these are test-mode balances." : ""}`}
        state={
          watched > 0 ? (
            <span className="bg-destructive/10 text-destructive rounded-full px-3 py-1 text-xs font-semibold" data-credits-watch>
              {watched} at {WATCH_PCT}%+
            </span>
          ) : null
        }
      >
        {rows.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">No place holds credit or has House Credits on yet.</p>
        ) : (
          <div className="-mx-4 mt-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[760px] text-sm" data-admin-credits-limit>
              <thead>
                <tr className="text-muted-foreground border-border border-b text-left">
                  <th className="px-4 py-2 font-medium sm:pl-0">Place</th>
                  <th className="px-4 py-2 font-medium">Currency</th>
                  <th className="px-4 py-2 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-2 text-right font-medium">Used</th>
                  <th className="px-4 py-2 text-right font-medium sm:pr-0">Limit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const hot = r.pct >= WATCH_PCT;
                  const href = businessPlaceHref(r.place_id, "admin");
                  const fallback = defaultFor.get(r.currency);
                  return (
                    <tr
                      key={r.place_id}
                      className={"border-border border-b last:border-0 " + (hot ? "bg-destructive/5" : "")}
                      data-place={r.place_id}
                      data-hot={hot || undefined}
                    >
                      <td className="px-4 py-3 sm:pl-0">
                        {href ? (
                          <a href={href} className="font-semibold hover:underline">
                            {r.place_name ?? r.place_id}
                          </a>
                        ) : (
                          <span className="font-semibold">{r.place_name ?? r.place_id}</span>
                        )}
                        {!r.house_credits ? <span className="text-muted-foreground block text-xs">House Credits off</span> : null}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">{r.currency}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {moneyLabel(r.outstanding_cents, r.currency)}
                      </td>
                      <td className={"px-4 py-3 text-right tabular-nums whitespace-nowrap " + (hot ? "text-destructive font-semibold" : "")}>
                        {pctText(r.pct)}
                      </td>
                      <td className="px-4 py-3 sm:pr-0">
                        <LimitEditor
                          key={`${r.override_cents}`}
                          cents={r.override_cents}
                          currency={r.currency}
                          placeholder={fallback !== undefined ? `${units(fallback)} default` : "No default"}
                          onSave={async (c) => after(await savePlaceLimit(r.place_id, c))}
                          onClear={async () => after(await savePlaceLimit(r.place_id, null))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={<CoinsIcon className="h-5 w-5" aria-hidden />}
        title="Defaults"
        subtitle="The limit for every place in that currency, unless the place has its own. Whole units. A lower limit never touches credit already owed; it only refuses the next voucher buy that would pass it."
      >
        <div className="-mx-4 mt-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[480px] text-sm" data-admin-credits-defaults>
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left">
                <th className="px-4 py-2 font-medium sm:pl-0">Currency</th>
                <th className="px-4 py-2 text-right font-medium sm:pr-0">Default limit</th>
              </tr>
            </thead>
            <tbody>
              {defaults.map((d) => (
                <tr key={d.currency} className="border-border border-b last:border-0" data-currency={d.currency}>
                  <td className="px-4 py-3 font-semibold sm:pl-0">
                    {d.currency}
                    <span className="text-muted-foreground block text-xs font-normal">{moneyLabel(d.limit_cents, d.currency)}</span>
                  </td>
                  <td className="px-4 py-3 sm:pr-0">
                    <LimitEditor
                      key={d.limit_cents}
                      cents={d.limit_cents}
                      currency={d.currency}
                      onSave={async (c) => after(await saveDefaultLimit(d.currency, c))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
