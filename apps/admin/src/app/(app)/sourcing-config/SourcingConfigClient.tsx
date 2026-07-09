"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Ban, Layers, Star, Users } from "lucide-react";
import {
  Collapsible,
  ErrorNote,
  SaveRow,
  SectionCard,
  Switch,
} from "../enricher-config/atlas-ui";
import {
  getSourcingConfig,
  updateSourcingConfig,
} from "./actions";
import {
  CHANNELS,
  EXCLUDED_CATEGORIES,
  FAMILIES,
  type ChannelKey,
  type FamilyKey,
  type SourcingConfig,
} from "./catalog";

export function SourcingConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: SourcingConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<SourcingConfig>(initialConfig);
  const [saved, setSaved] = useState<SourcingConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  // Re-fetch on mount so a client-side nav to the page shows the live row, not a
  // stale server render. On failure we keep the initial/default config usable.
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getSourcingConfig();
      if (!active || !r.ok) return;
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setError(null);
    })();
    return () => {
      active = false;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  const patch = <K extends keyof SourcingConfig[ChannelKey]>(
    channel: ChannelKey,
    key: K,
    value: SourcingConfig[ChannelKey][K],
  ) => {
    setCfg((c) => ({ ...c, [channel]: { ...c[channel], [key]: value } }));
    setOk(false);
  };

  const toggleFamily = (channel: ChannelKey, family: FamilyKey) => {
    setCfg((c) => {
      const has = c[channel].families.includes(family);
      const families = has
        ? c[channel].families.filter((f) => f !== family)
        : [...c[channel].families, family];
      return { ...c, [channel]: { ...c[channel], families } };
    });
    setOk(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateSourcingConfig(cfg);
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionCard
        icon={<Layers className="text-secondary h-4 w-4" />}
        title="Channels"
        subtitle="Each row is one way a place gets into Mesita. Pick the eligible place families and the Google quality floor (0 = no floor). Turning a channel off blocks every add through it."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </span>
          ) : null
        }
      >
        <div className="mt-5 -mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 px-4 sm:px-0">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="pb-2 pl-1 font-medium">Channel</th>
                <th className="pb-2 font-medium">Eligible families</th>
                <th className="pb-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3" /> Min ★
                  </span>
                </th>
                <th className="pb-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> Min reviews
                  </span>
                </th>
                <th className="pb-2 pr-1 text-right font-medium">On</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map((ch) => {
                const p = cfg[ch.key];
                const off = !p.enabled;
                return (
                  <tr
                    key={ch.key}
                    className="border-border/60 [&>td]:border-border/60 align-top [&>td]:border-t [&>td]:py-4"
                  >
                    <td className="max-w-[15rem] pr-4 pl-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{ch.label}</span>
                        {ch.live ? (
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            live
                          </span>
                        ) : (
                          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                            staged
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {ch.description}
                      </p>
                    </td>

                    <td className={"pr-4 " + (off ? "opacity-40" : "")}>
                      <div className="flex flex-wrap gap-1.5">
                        {FAMILIES.map((fam) => {
                          const on = p.families.includes(fam.key);
                          return (
                            <button
                              key={fam.key}
                              type="button"
                              disabled={off || pending}
                              onClick={() => toggleFamily(ch.key, fam.key)}
                              title={fam.blurb}
                              aria-pressed={on}
                              className={
                                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed " +
                                (on
                                  ? "border-secondary/30 bg-secondary/10 text-secondary"
                                  : "border-border text-muted-foreground hover:bg-muted")
                              }
                            >
                              <span aria-hidden>{fam.emoji}</span>
                              {fam.label}
                            </button>
                          );
                        })}
                      </div>
                      {p.families.length === 0 && !off && (
                        <p className="mt-1.5 text-xs text-amber-600">
                          No families — nothing is eligible for this channel.
                        </p>
                      )}
                    </td>

                    <td className={"pr-4 " + (off ? "opacity-40" : "")}>
                      <FloorInput
                        value={p.minRating}
                        min={0}
                        max={5}
                        step={0.1}
                        decimals
                        disabled={off || pending}
                        onChange={(v) => patch(ch.key, "minRating", v)}
                      />
                    </td>

                    <td className={"pr-4 " + (off ? "opacity-40" : "")}>
                      <FloorInput
                        value={p.minReviews}
                        min={0}
                        max={100000}
                        step={10}
                        disabled={off || pending}
                        onChange={(v) => patch(ch.key, "minReviews", v)}
                      />
                    </td>

                    <td className="pr-1 text-right">
                      <div className="inline-flex justify-end">
                        <Switch
                          on={p.enabled}
                          pending={pending}
                          label={`Enable ${ch.label}`}
                          onClick={() => patch(ch.key, "enabled", !p.enabled)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
        {error && <ErrorNote message={error} />}
      </SectionCard>

      {/* Families reference — the Google primary types behind each chip. */}
      <SectionCard
        icon={<Layers className="text-muted-foreground h-4 w-4" />}
        title="Families"
        subtitle="Each family maps to a set of Google Places (New) primary types. A place is that family when its Google primary type is in the set."
      >
        <Collapsible summary={`Show family → Google type mapping (${FAMILIES.length} families)`}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FAMILIES.map((fam) => (
              <li
                key={fam.key}
                className="border-border bg-background rounded-xl border p-3"
              >
                <p className="text-sm font-semibold">
                  <span aria-hidden className="mr-1.5">
                    {fam.emoji}
                  </span>
                  {fam.label}
                  <span className="text-muted-foreground ml-1.5 text-xs font-normal tabular-nums">
                    · {fam.googleTypes.length} types
                  </span>
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {fam.blurb}
                </p>
                <p className="text-muted-foreground/80 mt-2 font-mono text-[11px] leading-relaxed break-words">
                  {fam.googleTypes.slice(0, 10).join(" · ")}
                  {fam.googleTypes.length > 10
                    ? ` … +${fam.googleTypes.length - 10}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </Collapsible>
      </SectionCard>

      {/* Never-eligible reference. */}
      <SectionCard
        icon={<Ban className="text-muted-foreground h-4 w-4" />}
        title="Never eligible"
        subtitle="Google categories Mesita never sources from — they can't be enabled for any channel. A place only enters through an enabled family above."
      >
        <ul className="mt-4 flex flex-wrap gap-2">
          {EXCLUDED_CATEGORIES.map((c) => (
            <li
              key={c.label}
              className="border-border bg-background rounded-xl border px-3 py-2"
              title={c.examples}
            >
              <span className="text-sm font-medium">{c.label}</span>
              <span className="text-muted-foreground ml-2 font-mono text-[11px]">
                {c.examples}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

// Compact right-aligned number input for the in-table quality floors. 0 renders
// as a muted "off" placeholder so the table reads at a glance.
function FloorInput({
  value,
  min,
  max,
  step,
  decimals,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: boolean;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode={decimals ? "decimal" : "numeric"}
      min={min}
      max={max}
      step={step}
      value={value === 0 ? "" : value}
      placeholder="off"
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange(0);
          return;
        }
        const n = Number(raw);
        if (Number.isNaN(n)) return;
        const clamped = decimals
          ? Math.round(Math.min(Math.max(n, min), max) * 10) / 10
          : Math.min(Math.max(Math.round(n), min), max);
        onChange(clamped);
      }}
      className="border-border bg-card focus:border-foreground h-9 w-20 rounded-lg border px-2 text-right text-sm tabular-nums outline-none placeholder:text-xs placeholder:font-normal disabled:cursor-not-allowed"
    />
  );
}
