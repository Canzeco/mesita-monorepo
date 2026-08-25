"use client";

import { Layers, Star, Users } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { SectionCard, Switch } from "@/components/admin-ui/config";
import {
  ALL_FAMILY_KEYS,
  CHANNELS,
  FAMILIES,
  type ChannelKey,
  type FamilyKey,
  type SourcingConfig,
} from "./catalog";
import { familySummary } from "./family-summary";

/** Operator-facing summary derived from CHANNELS[].live — never hand-write which are live. */
function enforcedLiveCopy(): string {
  const live = CHANNELS.filter((c) => c.live);
  const pending = CHANNELS.filter((c) => !c.live);
  if (live.length === CHANNELS.length) {
    return "Enforced live today: every floor and family gate real search / add traffic.";
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
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
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
                              "min-h-9 rounded-lg border px-2 py-1.5 text-center text-sm leading-snug font-medium transition disabled:cursor-not-allowed " +
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
      subtitle="Search = who may appear. Add = who may be onboarded."
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
