"use client";

import { Layers, MapPin, Star, Users } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { SectionCard, Switch } from "@/components/admin-ui/config";
import {
  ALL_FAMILY_KEYS,
  applyRegionToAll,
  CHANNELS,
  channelsShareRegion,
  FAMILIES,
  matchRegionCity,
  REGION_CITIES,
  sharedRegion,
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
    return "Enforced live today: every floor, family and the one area above gate real search / add traffic.";
  }
  if (live.length === 0) {
    return "No channels are marked enforced live yet.";
  }
  return `Enforced live today: ${live.map((c) => c.label).join(", ")}. The remaining channels (${pending.map((c) => c.label).join(", ")}) apply as their search / add paths are wired.`;
}

const ACTORS = [...new Set(CHANNELS.map((c) => c.actor))];

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
      <WhereBar
        region={sharedRegion(cfg)}
        shared={channelsShareRegion(cfg)}
        disabled={pending}
        onChange={(region) => onChange(applyRegionToAll(cfg, region))}
      />
      <div className="mt-2">
        {ACTORS.map((actor) => {
          const rows = CHANNELS.filter((c) => c.actor === actor);
          return (
            <div
              key={actor}
              className="border-border border-t pt-3 pb-2 first:border-t-0 first:pt-1"
            >
              <p className="text-muted-foreground mb-1 type-label font-semibold tracking-[0.12em] uppercase">
                {actor}
              </p>
              {rows.map((ch) => {
                const p = cfg[ch.key];
                const off = !p.enabled;
                const summary = familySummary(p.families);
                return (
                  <div
                    key={ch.key}
                    className={"py-2.5 " + (off ? "opacity-50" : "")}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span
                        className="w-14 shrink-0 text-sm font-medium"
                        title={ch.description}
                      >
                        {ch.verb === "search" ? "Search" : "Add"}
                      </span>
                      <div className="flex gap-2">
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
                      <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
                        <label className="text-muted-foreground flex items-center gap-1 type-label">
                          <Star className="h-3 w-3" aria-hidden />
                          <FloorInput
                            value={p.minRating}
                            min={0}
                            max={5}
                            step={0.1}
                            decimals
                            disabled={off || pending}
                            onChange={(v) => patch(ch.key, "minRating", v)}
                            ariaLabel={`Min rating for ${ch.label}`}
                          />
                        </label>
                        <label className="text-muted-foreground flex items-center gap-1 type-label">
                          <Users className="h-3 w-3" aria-hidden />
                          <FloorInput
                            value={p.minReviews}
                            min={0}
                            max={100000}
                            step={10}
                            disabled={off || pending}
                            onChange={(v) => patch(ch.key, "minReviews", v)}
                            ariaLabel={`Min reviews for ${ch.label}`}
                          />
                        </label>
                        <Switch
                          on={p.enabled}
                          pending={pending}
                          label={`Enable ${ch.label}`}
                          onClick={() => patch(ch.key, "enabled", !p.enabled)}
                        />
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
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
                              "rounded-md border px-2 py-0.5 type-label font-medium transition disabled:cursor-not-allowed " +
                              (on
                                ? "border-foreground text-foreground"
                                : "border-transparent text-muted-foreground hover:bg-muted")
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
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-2 text-xs">{enforcedLiveCopy()}</p>
    </>
  );

  if (!framed) return body;

  return (
    <SectionCard
      icon={<Layers className="text-secondary h-4 w-4" />}
      title="Channels"
      subtitle="Search = who may appear. Add = who may be onboarded. One Where for every row."
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

function WhereBar({
  region,
  shared,
  disabled,
  onChange,
}: {
  region: RegionPolicy;
  shared: boolean;
  disabled: boolean;
  onChange: (next: RegionPolicy) => void;
}) {
  const set = (patch: Partial<RegionPolicy>) => onChange({ ...region, ...patch });
  const countryOn = region.country.trim() !== "";
  const cityId = matchRegionCity(region);
  const placeValue =
    !countryOn || region.radiusKm === 0 ? "country" : cityId;
  const showPin = countryOn && region.radiusKm > 0 && cityId === "custom";

  return (
    <div className="border-border mt-4 border-b pb-3">
      {!shared && (
        <p className="text-muted-foreground mb-2 text-xs">
          Channels had different areas — editing here applies one area to all of
          them.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground inline-flex items-center gap-1 type-label font-semibold tracking-[0.12em] uppercase">
          <MapPin className="h-3 w-3" aria-hidden />
          Where
        </span>
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
            const raw = e.target.value
              .replace(/[^a-zA-Z]/g, "")
              .toUpperCase()
              .slice(0, 2);
            set({ country: raw });
          }}
          className="border-border bg-card focus:border-foreground h-8 w-11 rounded-lg border px-1.5 text-center text-xs uppercase tabular-nums outline-none placeholder:text-xs placeholder:normal-case placeholder:font-normal disabled:cursor-not-allowed"
        />
        <select
          value={placeValue}
          disabled={disabled || !countryOn}
          aria-label="Area"
          onChange={(e) => {
            const v = e.target.value;
            if (v === "country") {
              set({ radiusKm: 0 });
              return;
            }
            if (v === "custom") {
              set({
                radiusKm: region.radiusKm > 0 ? region.radiusKm : 40,
              });
              return;
            }
            const city = REGION_CITIES.find((c) => c.id === v);
            if (!city) return;
            set({
              lat: city.lat,
              lng: city.lng,
              radiusKm: region.radiusKm > 0 ? region.radiusKm : 40,
            });
          }}
          className="border-border bg-card focus:border-foreground h-8 rounded-lg border px-2 text-xs outline-none disabled:cursor-not-allowed"
        >
          <option value="country">Whole country</option>
          {REGION_CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          <option value="custom">Custom pin</option>
        </select>
        {countryOn && region.radiusKm > 0 && (
          <label className="text-muted-foreground flex items-center gap-1 text-xs">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={2000}
              step={1}
              value={region.radiusKm}
              disabled={disabled}
              aria-label="Radius kilometers"
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isNaN(n)) return;
                set({
                  radiusKm: Math.min(2000, Math.max(1, Math.round(n * 10) / 10)),
                });
              }}
              className="border-border bg-card focus:border-foreground h-8 w-14 rounded-lg border px-1.5 text-right text-xs tabular-nums outline-none disabled:cursor-not-allowed"
            />
            km
          </label>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled || !countryOn}
            aria-pressed={!region.restrict}
            onClick={() => set({ restrict: false })}
            className={
              "h-8 rounded-lg border px-2.5 text-xs font-semibold disabled:cursor-not-allowed " +
              (!region.restrict
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:border-foreground/40")
            }
          >
            Prefer
          </button>
          <button
            type="button"
            disabled={disabled || !countryOn}
            aria-pressed={region.restrict}
            aria-label="Only this area"
            title="Hard fence — drop anything outside this country or circle"
            onClick={() => set({ restrict: true })}
            className={
              "h-8 rounded-lg border px-2.5 text-xs font-semibold disabled:cursor-not-allowed " +
              (region.restrict
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:border-foreground/40")
            }
          >
            Only
          </button>
        </div>
      </div>
      {showPin && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step={0.0001}
            min={-90}
            max={90}
            value={region.lat}
            disabled={disabled}
            aria-label="Latitude"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isNaN(n)) return;
              set({
                lat: Math.round(Math.min(90, Math.max(-90, n)) * 10000) / 10000,
              });
            }}
            className="border-border bg-card focus:border-foreground h-9 w-28 rounded-lg border px-2 text-right text-sm tabular-nums outline-none disabled:cursor-not-allowed"
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
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isNaN(n)) return;
              set({
                lng:
                  Math.round(Math.min(180, Math.max(-180, n)) * 10000) / 10000,
              });
            }}
            className="border-border bg-card focus:border-foreground h-9 w-28 rounded-lg border px-2 text-right text-sm tabular-nums outline-none disabled:cursor-not-allowed"
          />
        </div>
      )}
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
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: boolean;
  disabled: boolean;
  onChange: (v: number) => void;
  ariaLabel?: string;
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
      aria-label={ariaLabel}
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
      className="border-border bg-card focus:border-foreground h-8 w-14 rounded-lg border px-1.5 text-right text-xs tabular-nums outline-none placeholder:font-normal disabled:cursor-not-allowed"
    />
  );
}
