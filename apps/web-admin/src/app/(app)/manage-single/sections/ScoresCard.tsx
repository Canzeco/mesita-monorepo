"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import {
  DEFAULT_MANUAL_PRIORITY,
  SUBSCORE_BY_ID,
  coerceScoringSettings,
  gpParts,
  rpScore,
  unitDraw,
  xxScore,
  type ScoringSettings,
  type SubscoreId,
} from "@/lib/business/scores";
import { STRATEGY_BY_ID, strategyForPlace } from "@/lib/business/strategies";
import { getScoringSettings } from "@/app/(app)/lineup-config/settings-actions";
import type { AdminPlace } from "../actions";
import { GroupLabel, ReadField, SectionCard } from "../ui";

// Scores — every Lineup subscore that can be computed from THIS place alone
// (plus live Lineup Config knobs). EM and SM need a consumer+intent call, so
// they stay listed but not computed. Lives on Admin: the operator watches the
// place-side merit inputs that feed Organic (GP) and Inorganic (RP).

const PLACE_SIDE: readonly SubscoreId[] = ["gp", "mp", "rp", "xx"];
const NEEDS_CALL: readonly SubscoreId[] = ["em", "sm"];

function fmt01(n: number): string {
  return n.toFixed(2);
}

type Row = { id: SubscoreId; value: string; detail: string };

function placeScoreRows(
  place: AdminPlace,
  cfg: ScoringSettings,
): { placeSide: Row[]; needsCall: Row[] } {
  const gp = gpParts(
    place.google_review_count,
    place.google_stars_overall,
    cfg.gp,
  );
  const mp = place.manual_priority ?? DEFAULT_MANUAL_PRIORITY;
  const strategyId = strategyForPlace({
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
  });
  const rp = rpScore(strategyId, cfg.rp);
  const strategyLabel =
    strategyId != null
      ? `${STRATEGY_BY_ID[strategyId].emoji} ${STRATEGY_BY_ID[strategyId].name}`
      : "Custom / unmatched rates → zero rung";
  // Same seed the playground uses (roll=1) — a stable preview at the current
  // xx.control, not the live per-request Lineup draw.
  const xxOrganic = xxScore(unitDraw(place.id, "organic", 1), cfg.xx.control);
  const xxInorganic = xxScore(
    unitDraw(place.id, "inorganic", 1),
    cfg.xx.control,
  );

  const byId: Record<SubscoreId, Row> = {
    gp: {
      id: "gp",
      value: fmt01(gp.gp),
      detail:
        gp.rating == null || gp.reviews === 0
          ? "No Google presence — GP 0 (out of Organic)"
          : `${gp.rating.toFixed(1)}★ × ${gp.reviews.toLocaleString()} reviews · mass ${gp.raw.toFixed(0)} · lnCeiling ${cfg.gp.lnCeiling}`,
    },
    mp: {
      id: "mp",
      value: fmt01(mp),
      detail:
        mp === DEFAULT_MANUAL_PRIORITY
          ? "Baseline 0.1 — edit in Manual Priority above"
          : "Operator override — edit in Manual Priority above",
    },
    rp: {
      id: "rp",
      value: fmt01(rp),
      detail: `${strategyLabel} · rung from Lineup Config`,
    },
    xx: {
      id: "xx",
      value: `${fmt01(xxOrganic)} / ${fmt01(xxInorganic)}`,
      detail: `Organic / Inorganic · control ${cfg.xx.control} · seeded preview (roll 1)`,
    },
    em: {
      id: "em",
      value: "—",
      detail: SUBSCORE_BY_ID.em.basis,
    },
    sm: {
      id: "sm",
      value: "—",
      detail: SUBSCORE_BY_ID.sm.basis,
    },
  };
  return {
    placeSide: PLACE_SIDE.map((id) => byId[id]),
    needsCall: NEEDS_CALL.map((id) => byId[id]),
  };
}

export function ScoresCard({ place }: { place: AdminPlace }) {
  const [settings, setSettings] = useState<ScoringSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getScoringSettings().then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setSettingsError(r.error);
        setSettings(coerceScoringSettings(null));
        return;
      }
      setSettingsError(null);
      setSettings(coerceScoringSettings(r.config));
    });
    return () => {
      alive = false;
    };
  }, []);

  const rows = placeScoreRows(place, settings ?? coerceScoringSettings(null));

  return (
    <SectionCard
      icon={<Gauge className="h-4 w-4" />}
      tint="amber"
      title="Scores"
      subtitle="Place-side Lineup subscores — computed from this place + Lineup Config. EM and SM need a consumer+intent call, so they stay listed but blank."
    >
      <div className="mt-5 grid gap-4">
        <div className="grid gap-2">
          <GroupLabel>Computable here</GroupLabel>
          {settingsError ? (
            <p className="text-muted-foreground text-[11px] leading-snug">
              Lineup Config unavailable ({settingsError}) — showing code defaults.
            </p>
          ) : null}
          {rows.placeSide.map((row) => (
            <ScoreRow key={row.id} {...row} />
          ))}
        </div>

        <div className="grid gap-2">
          <GroupLabel>Needs consumer + intent</GroupLabel>
          {rows.needsCall.map((row) => (
            <ScoreRow key={row.id} {...row} muted />
          ))}
        </div>

        <p className="text-muted-foreground text-[11px] leading-snug">
          Lane scores (Organic = EM·SM·GP·MP·XX · Inorganic = EM·SM·RP·MP·XX) need
          the full call — only the place-side factors above are honest without a
          consumer. Knobs live in{" "}
          <a
            href="/lineup-config"
            className="text-foreground underline-offset-2 hover:underline"
          >
            Lineup Config
          </a>
          .
        </p>
      </div>
    </SectionCard>
  );
}

function ScoreRow({
  id,
  value,
  detail,
  muted,
}: {
  id: SubscoreId;
  value: string;
  detail: string;
  muted?: boolean;
}) {
  const def = SUBSCORE_BY_ID[id];
  return (
    <ReadField label={`${def.emoji} ${def.short} · ${def.name}`} boxed>
      <span
        className={
          "flex min-w-0 flex-1 flex-col gap-0.5 py-0.5 " +
          (muted ? "opacity-55" : "")
        }
      >
        <span className="font-display text-lg font-semibold tabular-nums leading-none">
          {value}
        </span>
        <span className="text-muted-foreground text-[11px] leading-snug">
          {detail}
        </span>
      </span>
    </ReadField>
  );
}
