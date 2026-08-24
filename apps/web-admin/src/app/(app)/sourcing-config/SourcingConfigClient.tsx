"use client";

import { Globe, Layers, Lock, Star, Users } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { SectionCard, Switch } from "@/components/admin-ui/config";
import {
  ALL_FAMILY_KEYS,
  CHANNELS,
  DEFAULT_REGION,
  FAMILIES,
  type ChannelKey,
  type FamilyKey,
  type RegionPolicy,
  type SourcingConfig,
} from "./catalog";
import { familySummary } from "./family-summary";

/** Operator-facing summary derived from CHANNELS[].live — never hand-write which are live. */
function enforcedLiveCopy(): string {
  const live = CHANNELS.filter((c) => c.live);
  const pending = CHANNELS.filter((c) => !c.live);
  if (live.length === CHANNELS.length) {
    return "Enforced live today: every floor, family and region above gates real search / add traffic.";
  }
  if (live.length === 0) {
    return "No channels are marked enforced live yet.";
  }
  return `Enforced live today: ${live.map((c) => c.label).join(", ")}. The remaining channels (${pending.map((c) => c.label).join(", ")}) apply as their search / add paths are wired.`;
}

const ACTORS = [...new Set(CHANNELS.map((c) => c.actor))];

const ROW =
  "grid grid-cols-[4.5rem_minmax(7rem,1fr)_minmax(10.5rem,13rem)_4.75rem_5.75rem_2.75rem] items-start gap-x-3";

// CONTROLLED. Intake owns the config and the one Save button on the page, so
// this renders the matrix and nothing else — no state, no fetch, no save. It
// stays in this folder because `catalog.ts` beside it is cited BY PATH from
// web-consumer, mobile-consumer and `_shared/sourcing.ts` as the FAMILIES
// authoring source; a folder with no page.tsx is just a module folder.
export function SourcingChannels({
  config: cfg,
  onChange,
  disabled: pending,
  updatedAt,
  framed = true,
}: {
  config: SourcingConfig;
  onChange: (next: SourcingConfig) => void;
  disabled: boolean;
  updatedAt: string | null;
  /** False when a parent SectionCard already owns the chrome (Intake). */
  framed?: boolean;
}) {
  const patch = <K extends keyof SourcingConfig[ChannelKey]>(
    channel: ChannelKey,
    key: K,
    value: SourcingConfig[ChannelKey][K],
  ) => {
    onChange({ ...cfg, [channel]: { ...cfg[channel], [key]: value } });
  };

  const setFamilies = (channel: ChannelKey, families: FamilyKey[]) => {
    onChange({ ...cfg, [channel]: { ...cfg[channel], families } });
  };

  const toggleFamily = (channel: ChannelKey, family: FamilyKey) => {
    const has = cfg[channel].families.includes(family);
    setFamilies(
      channel,
      has
        ? cfg[channel].families.filter((f) => f !== family)
        : [...cfg[channel].families, family],
    );
  };

  const body = (
    <>
      <div className="mt-5">
        <div
          className={
            ROW + " text-muted-foreground type-label pb-2 font-medium"
          }
        >
          <span />
          <span>Families</span>
          <span className="inline-flex items-center gap-1">
            <Globe className="h-3 w-3" /> Region
          </span>
          <span className="inline-flex items-center justify-end gap-1">
            <Star className="h-3 w-3" /> Min ★
          </span>
          <span className="inline-flex items-center justify-end gap-1">
            <Users className="h-3 w-3" /> Reviews
          </span>
          <span className="text-right">On</span>
        </div>

        {ACTORS.map((actor) => {
          const rows = CHANNELS.filter((c) => c.actor === actor);
          return (
            <div
              key={actor}
              className="border-border border-t pt-3 pb-1 first:border-t-0 first:pt-0"
            >
              <p className="text-muted-foreground mb-1.5 type-label font-semibold tracking-[0.12em] uppercase">
                {actor}
              </p>
              {rows.map((ch) => {
                const p = cfg[ch.key];
                const off = !p.enabled;
                const summary = familySummary(p.families);
                return (
                  <div
                    key={ch.key}
                    className={ROW + " py-2 " + (off ? "opacity-50" : "")}
                  >
                    <span
                      className="pt-1.5 text-sm"
                      title={ch.description}
                    >
                      {ch.verb === "search" ? "Search" : "Add"}
                    </span>
                    <div className="min-w-0">
                      <div className="mb-1.5 flex gap-2">
                        <button
                          type="button"
                          disabled={off || pending}
                          onClick={() =>
                            setFamilies(ch.key, [...ALL_FAMILY_KEYS])
                          }
                          className="text-muted-foreground hover:text-foreground type-label font-medium disabled:opacity-40"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          disabled={off || pending}
                          onClick={() => setFamilies(ch.key, [])}
                          className="text-muted-foreground hover:text-foreground type-label font-medium disabled:opacity-40"
                        >
                          None
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
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
                                "rounded-lg border px-2 py-1 type-label font-medium transition disabled:cursor-not-allowed " +
                                (on
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border text-muted-foreground hover:bg-muted")
                              }
                            >
                              {fam.label}
                            </button>
                          );
                        })}
                      </div>
                      {summary.kind === "none" && !off && (
                        <p className="mt-1.5 text-xs text-amber-600">
                          Nothing is eligible for this channel.
                        </p>
                      )}
                    </div>
                    <RegionCell
                      region={p.region ?? DEFAULT_REGION}
                      disabled={off || pending}
                      onChange={(region) => patch(ch.key, "region", region)}
                    />
                    <div className="flex justify-end">
                      <FloorInput
                        value={p.minRating}
                        min={0}
                        max={5}
                        step={0.1}
                        decimals
                        disabled={off || pending}
                        onChange={(v) => patch(ch.key, "minRating", v)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <FloorInput
                        value={p.minReviews}
                        min={0}
                        max={100000}
                        step={10}
                        disabled={off || pending}
                        onChange={(v) => patch(ch.key, "minReviews", v)}
                      />
                    </div>
                    <div className="flex justify-end pt-0.5">
                      <Switch
                        on={p.enabled}
                        pending={pending}
                        label={`Enable ${ch.label}`}
                        onClick={() => patch(ch.key, "enabled", !p.enabled)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-3 text-xs">{enforcedLiveCopy()}</p>
    </>
  );

  if (!framed) return body;

  return (
    <SectionCard
      icon={<Layers className="text-secondary h-4 w-4" />}
      title="Channels"
      subtitle="Search = what may appear in that surface's searchbar. Add = what may be onboarded. Floors are Google rating / review counts; 0 = no floor. Region is the Places country + optional circle; lock is a hard fence."
      status={
        updatedAt ? (
          <span className="text-muted-foreground text-xs">
            Updated {formatShortDate(updatedAt)}
          </span>
        ) : null
      }
    >
      {body}
    </SectionCard>
  );
}

function RegionCell({
  region,
  disabled,
  onChange,
}: {
  region: RegionPolicy;
  disabled: boolean;
  onChange: (next: RegionPolicy) => void;
}) {
  const set = (patch: Partial<RegionPolicy>) => onChange({ ...region, ...patch });
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="text"
          maxLength={2}
          value={region.country}
          placeholder="off"
          disabled={disabled}
          aria-label="Country"
          title="CLDR country (MX). Empty = off."
          onChange={(e) => {
            const raw = e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
            set({ country: raw });
          }}
          className="border-border bg-card focus:border-foreground h-9 w-11 rounded-lg border px-1.5 text-center text-sm uppercase tabular-nums outline-none placeholder:text-xs placeholder:normal-case placeholder:font-normal disabled:cursor-not-allowed"
        />
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={2000}
          step={1}
          value={region.radiusKm === 0 ? "" : region.radiusKm}
          placeholder="km"
          disabled={disabled}
          aria-label="Radius kilometers"
          title="Circle radius. 0 = country only. Guest pin, if present, is the centre."
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              set({ radiusKm: 0 });
              return;
            }
            const n = Number(raw);
            if (Number.isNaN(n)) return;
            set({ radiusKm: Math.min(2000, Math.max(0, Math.round(n * 10) / 10)) });
          }}
          className="border-border bg-card focus:border-foreground h-9 w-14 rounded-lg border px-1.5 text-right text-sm tabular-nums outline-none placeholder:text-xs placeholder:font-normal disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled}
          aria-pressed={region.restrict}
          title={
            region.restrict
              ? "Lock on: Google restriction + add-path reject outsiders"
              : "Lock off: Google bias only — outsiders may still appear"
          }
          onClick={() => set({ restrict: !region.restrict })}
          className={
            "inline-flex h-9 w-9 items-center justify-center rounded-lg border type-label disabled:cursor-not-allowed " +
            (region.restrict
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:bg-muted")
          }
        >
          <Lock className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Lock region</span>
        </button>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={0.0001}
          min={-90}
          max={90}
          value={region.lat}
          disabled={disabled}
          aria-label="Latitude"
          title="Fallback circle centre when the guest has no pin"
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isNaN(n)) return;
            set({ lat: Math.round(Math.min(90, Math.max(-90, n)) * 10000) / 10000 });
          }}
          className="border-border bg-card focus:border-foreground h-8 min-w-0 flex-1 rounded-lg border px-1.5 text-right type-meta tabular-nums outline-none disabled:cursor-not-allowed"
        />
        <input
          type="number"
          inputMode="decimal"
          step={0.0001}
          min={-180}
          max={180}
          value={region.lng}
          disabled={disabled}
          aria-label="Longitude"
          title="Fallback circle centre when the guest has no pin"
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isNaN(n)) return;
            set({ lng: Math.round(Math.min(180, Math.max(-180, n)) * 10000) / 10000 });
          }}
          className="border-border bg-card focus:border-foreground h-8 min-w-0 flex-1 rounded-lg border px-1.5 text-right type-meta tabular-nums outline-none disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

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
      className="border-border bg-card focus:border-foreground h-9 w-full max-w-[5.5rem] rounded-lg border px-2 text-right text-sm tabular-nums outline-none placeholder:text-xs placeholder:font-normal disabled:cursor-not-allowed"
    />
  );
}
