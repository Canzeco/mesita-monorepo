"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Compass, Megaphone } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import { KnobStatus, SaveRow, SectionCard, Switch } from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DEFAULT_CONFIG,
  SIGNALS,
  SLOT_MAX_EVERY_NTH,
  SLOT_MIN_EVERY_NTH,
  WEIGHT_MAX,
  WEIGHT_MIN,
  WIRED_ENGINES,
  weightMeaning,
  type DiscoveryConfig,
  type SignalKey,
} from "./catalog";

/** The exponent step. Matches the two-decimal rounding in catalog.coerceConfig. */
const STEP = 0.05;

export function DiscoveryConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: DiscoveryConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<DiscoveryConfig>(initialConfig);
  const [saved, setSaved] = useState<DiscoveryConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  // Re-fetch on mount so a client-side nav shows the live row, not a stale
  // server render. Success clears a failed-load Save block (MESITA-737).
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getDiscoveryConfig();
      if (!active) return;
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  const setWeight = (key: SignalKey, value: number) => {
    const clamped = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, value));
    setCfg((c) => ({
      ...c,
      weights: { ...c.weights, [key]: Math.round(clamped * 100) / 100 },
    }));
    setOk(false);
  };

  const setSlotting = <K extends keyof DiscoveryConfig["slotting"]>(
    key: K,
    value: DiscoveryConfig["slotting"][K],
  ) => {
    setCfg((c) => ({ ...c, slotting: { ...c.slotting, [key]: value } }));
    setOk(false);
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  const allOff = SIGNALS.every((s) => cfg.weights[s.key] <= 0);

  return (
    <div className="space-y-6">
      <SectionCard
        icon={<Compass className="text-secondary h-4 w-4" />}
        title="Signals"
        subtitle="Weights are EXPONENTS, not multipliers: each signal enters the blend as s^w. Because every signal scores 0–1, a bigger exponent is harsher — it pushes everything short of near-perfect toward zero. 0 switches a signal off. What matters is the ratio between rows: Proximity at 2 against Popularity at 1 is what “twice as important” means."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {formatShortDate(updatedAt)}
            </span>
          ) : null
        }
      >
        <div className="mt-4">
          <KnobStatus
            kind="enforced"
            reason={`Enforced on ${WIRED_ENGINES.join(", ")} today. Map, Favorites and the parked engines still serve their own order — each one is wired as it is rebuilt.`}
          />
        </div>

        <div className="mt-5 -mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 px-4 sm:px-0">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="pb-2 pl-1 font-medium">Signal</th>
                <th className="pb-2 font-medium">Reads</th>
                <th className="w-28 pb-2 text-right font-medium">Exponent</th>
                <th className="w-48 pb-2 pr-1 font-medium">Effect</th>
              </tr>
            </thead>
            <tbody>
              {SIGNALS.map((s) => {
                const w = cfg.weights[s.key];
                const off = w <= 0;
                return (
                  <tr
                    key={s.key}
                    className="border-border/50 align-top [&>td]:border-t [&>td]:py-3"
                  >
                    <td className="pl-1 pr-4">
                      <div className={"text-sm font-semibold" + (off ? " opacity-50" : "")}>
                        {s.label}
                      </div>
                      <div className="text-muted-foreground mt-0.5 type-label">
                        {s.blurb}
                      </div>
                    </td>
                    <td className="text-muted-foreground pr-4 type-label">{s.reads}</td>
                    <td className="pr-4">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={WEIGHT_MIN}
                        max={WEIGHT_MAX}
                        step={STEP}
                        value={w}
                        disabled={pending}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (Number.isNaN(raw)) return;
                          setWeight(s.key, raw);
                        }}
                        className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
                      />
                    </td>
                    <td
                      className={
                        "pr-1 type-label " +
                        (off ? "text-muted-foreground" : "text-foreground")
                      }
                    >
                      {weightMeaning(w)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {allOff && (
          <p className="text-muted-foreground mt-4 type-label">
            Every signal is off, so every place ties and the deck falls back to
            the pool&rsquo;s own order. That is a legal setting — it is what
            Discovery served before this model existed — but nothing is ranking.
          </p>
        )}

        <p className="text-muted-foreground mt-4 type-label">
          A signal with nothing to read abstains at 1 and drops out of the blend
          rather than penalising the place — a guest who sent no location does
          not make every place worse. There is no Promoting row here on purpose:
          the bought lane is below, and it never touches a score.
        </p>
      </SectionCard>

      <SectionCard
        icon={<Megaphone className="text-secondary h-4 w-4" />}
        title="Bought slots"
        subtitle="The second lane. Places that buy a Strategy do not score higher — every Nth position in the deck becomes a slot, and a promoting place is moved forward into it. Rank is never for sale: with slotting on or off, the relative order of every place that bought nothing is identical."
      >
        <div className="mt-4">
          <KnobStatus
            kind="enforced"
            reason="Enforced on Swipe. Strategy tier decides who takes the next slot (Dominant › Aggressive › Conservative); inside a tier, the better-ranked place goes first."
          />
        </div>

        <div className="mt-5 space-y-4">
          <div className="border-border bg-background flex items-start justify-between gap-4 rounded-xl border p-4">
            <div>
              <div className="text-sm font-medium leading-snug">
                Give promoting places bought slots
              </div>
              <div className="text-muted-foreground mt-0.5 type-label">
                Off serves the earned order alone — no place is moved forward,
                whatever it pays.
              </div>
            </div>
            <Switch
              label="Give promoting places bought slots"
              on={cfg.slotting.enabled}
              pending={pending}
              onClick={() => setSlotting("enabled", !cfg.slotting.enabled)}
            />
          </div>

          <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
            <span className="text-sm font-medium leading-snug">
              A bought slot every… (cards)
            </span>
            <span className="text-muted-foreground type-label">
              {SLOT_MIN_EVERY_NTH} is the floor, so the top of the deck and at
              least every other card are always earned. Higher is rarer.
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={SLOT_MIN_EVERY_NTH}
              max={SLOT_MAX_EVERY_NTH}
              step={1}
              value={cfg.slotting.everyNth}
              disabled={pending || !cfg.slotting.enabled}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (Number.isNaN(raw)) return;
                setSlotting(
                  "everyNth",
                  Math.min(SLOT_MAX_EVERY_NTH, Math.max(SLOT_MIN_EVERY_NTH, Math.round(raw))),
                );
              }}
              className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
            />
          </label>
        </div>
      </SectionCard>

      {error && <ErrorNote message={error} />}

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadBlocked ? error : null}
      />

      <p className="text-muted-foreground type-label">
        Defaults: every earned signal at {DEFAULT_CONFIG.weights.proximity}, except Randomness at{" "}
        {DEFAULT_CONFIG.weights.randomness} so it softens into a tiebreak. Flat is
        the honest starting point — nothing has been measured yet, and a
        fabricated weighting would read as a finding.
      </p>
    </div>
  );
}
