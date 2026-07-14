"use client";

import { createContext, useContext, useState } from "react";
import {
  DEFAULT_ENGINE_MIX,
  DEFAULT_RETRIEVAL,
  DEFAULT_SCORES_CONFIG,
  type EngineId,
  type LaneId,
  type ScoresConfig,
} from "@/lib/business/scores";
import { PROMO_SCORE_BY_STRATEGY, type StrategyId } from "@/lib/business/strategies";
import type { SampleConsumer, SamplePlace } from "@/lib/business/cip";

// Shared state for the Scoring Config tabs. The layout mounts this ONCE, so
// hyperparameters set on Params carry into the Playground tab unchanged — and
// survive tab switches, because the layout (and this provider) persist across
// child navigation. The DB sample flows through as plain props (no state), so
// a Resample (router.refresh) delivers fresh rows without resetting knobs.

type EngineMix = Record<EngineId, Record<LaneId, number>>;
type Retrieval = typeof DEFAULT_RETRIEVAL;
type PromoVals = Record<StrategyId, number>;

type ScoringCtx = {
  consumers: SampleConsumer[];
  places: SamplePlace[];
  cfg: ScoresConfig;
  setCfg: React.Dispatch<React.SetStateAction<ScoresConfig>>;
  mix: EngineMix;
  setMix: React.Dispatch<React.SetStateAction<EngineMix>>;
  retrieval: Retrieval;
  setRetrieval: React.Dispatch<React.SetStateAction<Retrieval>>;
  promoVals: PromoVals;
  setPromoVals: React.Dispatch<React.SetStateAction<PromoVals>>;
};

const Ctx = createContext<ScoringCtx | null>(null);

export function ScoringProvider({
  consumers,
  places,
  children,
}: {
  consumers: SampleConsumer[];
  places: SamplePlace[];
  children: React.ReactNode;
}) {
  const [cfg, setCfg] = useState<ScoresConfig>(DEFAULT_SCORES_CONFIG);
  const [mix, setMix] = useState<EngineMix>(DEFAULT_ENGINE_MIX);
  const [retrieval, setRetrieval] = useState<Retrieval>(DEFAULT_RETRIEVAL);
  const [promoVals, setPromoVals] = useState<PromoVals>({ ...PROMO_SCORE_BY_STRATEGY });

  return (
    <Ctx.Provider
      value={{
        consumers,
        places,
        cfg,
        setCfg,
        mix,
        setMix,
        retrieval,
        setRetrieval,
        promoVals,
        setPromoVals,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useScoring(): ScoringCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScoring must be used inside ScoringProvider");
  return ctx;
}
