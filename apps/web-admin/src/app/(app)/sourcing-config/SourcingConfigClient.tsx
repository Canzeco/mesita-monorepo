"use client";

import { Layers, Star, Users } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { SectionCard, Switch } from "../enricher-config/atlas-ui";
import {
  CHANNELS,
  FAMILIES,
  type ChannelKey,
  type FamilyKey,
  type SourcingConfig,
} from "./catalog";

/** Operator-facing summary derived from CHANNELS[].live — never hand-write which are live. */
function enforcedLiveCopy(): string {
  const live = CHANNELS.filter((c) => c.live);
  const pending = CHANNELS.filter((c) => !c.live);
  if (live.length === CHANNELS.length) {
    return "Enforced live today: all channels. Every floor and family toggle above gates real search / add traffic.";
  }
  if (live.length === 0) {
    return "No channels are marked enforced live yet.";
  }
  return `Enforced live today: ${live.map((c) => c.label).join(", ")}. The remaining channels (${pending.map((c) => c.label).join(", ")}) apply as their search / add paths are wired.`;
}

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

  const toggleFamily = (channel: ChannelKey, family: FamilyKey) => {
    const has = cfg[channel].families.includes(family);
    const families = has
      ? cfg[channel].families.filter((f) => f !== family)
      : [...cfg[channel].families, family];
    onChange({ ...cfg, [channel]: { ...cfg[channel], families } });
  };

  const body = (
    <>
      <div className="mt-5 -mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[680px] border-separate border-spacing-0 px-4 sm:px-0">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="pb-2 pl-1 font-medium" colSpan={2}>
                Channel
              </th>
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
            {CHANNELS.map((ch, idx) => {
              const p = cfg[ch.key];
              const off = !p.enabled;
              // Actor cell spans its search/add pair; thicker rule between actors.
              const newGroup = idx === 0 || CHANNELS[idx - 1].actor !== ch.actor;
              const rowsInGroup = CHANNELS.filter(
                (c) => c.actor === ch.actor,
              ).length;
              return (
                <tr
                  key={ch.key}
                  className={
                    "align-top [&>td]:py-3 [&>td]:border-t " +
                    (newGroup
                      ? "[&>td]:border-border [&>td]:border-t-2"
                      : "[&>td]:border-border/50")
                  }
                >
                  {newGroup && (
                    <td rowSpan={rowsInGroup} className="w-24 pr-2 pl-1">
                      <span className="text-sm font-semibold">{ch.actor}</span>
                    </td>
                  )}
                  <td className="w-24 pr-4" title={ch.description}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-sm">
                        {ch.verb === "search" ? "Search" : "Add"}
                      </span>
                      {ch.live && (
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 type-meta font-medium text-green-700">
                          live
                        </span>
                      )}
                    </span>
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

      <p className="text-muted-foreground mt-3 text-xs">
        {enforcedLiveCopy()} Hover a channel or family chip for details.
      </p>
    </>
  );

  if (!framed) return body;

  return (
    <SectionCard
      icon={<Layers className="text-secondary h-4 w-4" />}
      title="Channels"
      subtitle="Search = what may appear in that surface's searchbar (including Google places not yet in Mesita). Add = what may be onboarded as a Mesita place. Floors are Google rating / review counts; 0 = no floor."
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
