"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CoinsIcon, GaugeIcon } from "@phosphor-icons/react";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import {
  Button,
  Chip,
  EmptyState,
  Notice,
  SectionCard,
  TBody,
  THead,
  Table,
  Td,
  TextField,
  Th,
  Tr,
} from "@/components/admin-ui";
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

/** The tier's words (MESITA-4733): what earns the limit. */
export function tierText(tier: LimitPlace["tier_name"] | LimitPlace["tier"]): string {
  switch (tier) {
    case "none":
      return "Credits Account off";
    case "credits":
      return "Credits Account";
    case "stripe":
      return "Credits + Stripe";
    case "default":
      return "Currency default";
    case "custom":
      return "Own limit";
    default:
      return "";
  }
}

/** One limit: a whole-units input and Save; a place also gets Use tier. */
function LimitEditor({
  cents,
  currency,
  of,
  onSave,
  onClear,
  clearLabel = "Use default",
  placeholder,
}: {
  cents: number | null;
  currency: string;
  /** Whose limit, for a screen reader: the place, or the currency's default. */
  of: string;
  onSave: (cents: number) => Promise<string | null>;
  onClear?: () => Promise<string | null>;
  clearLabel?: string;
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
        <TextField
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          placeholder={placeholder}
          aria-label={`${of}: limit in ${currency}`}
          onChange={setDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty && parsed !== null) run(() => onSave(parsed));
          }}
          className="w-36"
        />
        <Button size="sm" aria-label={`Save ${of}`} pending={pending} disabled={!dirty} onClick={() => parsed !== null && run(() => onSave(parsed))}>
          Save
        </Button>
        {onClear && cents !== null ? (
          <Button size="sm" tone="secondary" pending={pending} onClick={() => run(onClear)}>
            {clearLabel}
          </Button>
        ) : null}
      </div>
      {error ? <Notice>{error}</Notice> : null}
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
        icon={<GaugeIcon aria-hidden />}
        title="Places"
        subtitle={`Every place holding credit or with Loyalty Cards on, most used first. Outstanding is Available plus Pending, every guest, plus unclaimed gifts. ${WATCH_PCT}% and over is highlighted.${testMode ? " Test mode: these are test-mode balances." : ""}`}
        right={
          watched > 0 ? (
            <Chip tone="danger" data-credits-watch>
              {watched} at {WATCH_PCT}%+
            </Chip>
          ) : null
        }
      >
        {rows.length === 0 ? (
          <EmptyState className="mt-4">No place holds credit or has Loyalty Cards on yet.</EmptyState>
        ) : (
          <div className="mt-4">
            <Table className="min-w-[760px]" data-admin-credits-limit>
              <THead>
                <Tr>
                  <Th>Place</Th>
                  <Th>Currency</Th>
                  <Th numeric>Outstanding</Th>
                  <Th numeric>Used</Th>
                  <Th numeric>Limit</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const hot = r.pct >= WATCH_PCT;
                  const href = businessPlaceHref(r.place_id, "admin");
                  // THE TIER, NOT THE MXN DEFAULT (MESITA-4733): a Mexican
                  // place earns 0 · MX$10,000 · MX$50,000 (MESITA-4732);
                  // older servers send no tier_limit_cents and fall back to
                  // the currency's default.
                  const fallback = r.tier_limit_cents !== undefined ? r.tier_limit_cents : defaultFor.get(r.currency);
                  const fallbackName = tierText(r.tier_name) || "default";
                  return (
                    <Tr
                      key={r.place_id}
                      className={hot ? "bg-destructive/5" : undefined}
                      data-place={r.place_id}
                      data-hot={hot || undefined}
                    >
                      <Td>
                        {href ? (
                          <a href={href} className="font-semibold hover:underline">
                            {r.place_name ?? r.place_id}
                          </a>
                        ) : (
                          <span className="font-semibold">{r.place_name ?? r.place_id}</span>
                        )}
                        {!r.loyalty_cards ? <span className="text-muted-foreground block text-xs">Loyalty Cards off</span> : null}
                      </Td>
                      <Td className="text-muted-foreground">
                        {r.currency}
                        {r.tier ? <span className="block text-xs">{tierText(r.tier)}</span> : null}
                      </Td>
                      <Td numeric className="whitespace-nowrap">
                        {moneyLabel(r.outstanding_cents, r.currency)}
                      </Td>
                      <Td numeric className={hot ? "text-destructive font-semibold whitespace-nowrap" : "whitespace-nowrap"}>
                        {pctText(r.pct)}
                      </Td>
                      <Td>
                        <LimitEditor
                          key={`${r.override_cents}`}
                          cents={r.override_cents}
                          currency={r.currency}
                          of={r.place_name ?? r.place_id}
                          placeholder={fallback !== undefined && fallback !== null ? `${units(fallback)} · ${fallbackName}` : "No default"}
                          onSave={async (c) => after(await savePlaceLimit(r.place_id, c))}
                          onClear={async () => after(await savePlaceLimit(r.place_id, null))}
                          clearLabel={r.tier_name && r.tier_name !== "default" ? "Use tier" : "Use default"}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={<CoinsIcon aria-hidden />}
        title="Defaults"
        subtitle="The limit for every place in that currency, unless the place has its own. Mexican places use tiers instead (MESITA-4732): 0 while the Credits Account is off, MX$10,000 once it is on, MX$50,000 once Stripe can also charge; the MXN row here no longer binds. Whole units. A lower limit never touches credit already owed; it only refuses the next voucher buy that would pass it."
      >
        <div className="mt-4">
          <Table className="min-w-[480px]" data-admin-credits-defaults>
            <THead>
              <Tr>
                <Th>Currency</Th>
                <Th numeric>Default limit</Th>
              </Tr>
            </THead>
            <TBody>
              {defaults.map((d) => (
                <Tr key={d.currency} data-currency={d.currency}>
                  <Td className="font-semibold">
                    {d.currency}
                    <span className="text-muted-foreground block text-xs font-normal">
                      {d.currency === "MXN" ? "Not used: Mexican places use the tiers" : moneyLabel(d.limit_cents, d.currency)}
                    </span>
                  </Td>
                  <Td>
                    <LimitEditor
                      key={d.limit_cents}
                      cents={d.limit_cents}
                      currency={d.currency}
                      of={`${d.currency} default`}
                      onSave={async (c) => after(await saveDefaultLimit(d.currency, c))}
                    />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
