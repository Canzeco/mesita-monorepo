"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import {
  coerceScoringSettings,
  DEFAULT_SCORES_CONFIG,
  DEFAULT_SCORING_SETTINGS,
  type EngineId,
  type LaneId,
  type ScoresConfig,
  type ScoringSettings,
} from "@/lib/business/scores";
import { type StrategyId } from "@/lib/business/strategies";
import type { SampleConsumer, SamplePlace } from "@/lib/business/cip";
import { updateScoringSettings } from "./settings-actions";

// Shared state for the Scoring Config tabs. The layout mounts this ONCE, so
// hyperparameters set on Params carry into the Playground tab live and
// survive tab switches. The DB sample flows through as plain props; the SAVED
// settings blob seeds the knobs on first mount (null in DB = code defaults).
//
// Save = whole-blob write to app_settings.scoring_config via the EF pair.
// Reset-to-defaults = load DEFAULT_SCORING_SETTINGS into the form (dirty
// until saved). Cancel = revert the form to the last-saved values.

type EngineMix = Record<EngineId, Record<LaneId, number>>;
type Retrieval = ScoringSettings["retrieval"];
type PromoVals = Record<StrategyId, number>;

function fromSettings(s: ScoringSettings): {
  cfg: ScoresConfig;
  mix: EngineMix;
  retrieval: Retrieval;
  promoVals: PromoVals;
} {
  return {
    cfg: { ...DEFAULT_SCORES_CONFIG, ...s.ww },
    mix: s.mix,
    retrieval: s.retrieval,
    promoVals: { ...s.promos },
  };
}

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
  /** Current form as a settings blob. */
  current: ScoringSettings;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  savedOk: boolean;
  save: () => void;
  /** Load code defaults into the form (dirty until saved). */
  resetToDefaults: () => void;
  /** Revert the form to the last-saved values. */
  revert: () => void;
};

const Ctx = createContext<ScoringCtx | null>(null);

export function ScoringProvider({
  consumers,
  places,
  initialConfig,
  children,
}: {
  consumers: SampleConsumer[];
  places: SamplePlace[];
  /** Raw app_settings.scoring_config (null = code defaults). */
  initialConfig: unknown;
  children: React.ReactNode;
}) {
  // Seed once from the saved blob; the provider persists across tab
  // navigation and router.refresh, so knobs never reset behind the operator.
  const [saved, setSaved] = useState<ScoringSettings>(() =>
    coerceScoringSettings(initialConfig),
  );
  const seed = useMemo(() => fromSettings(saved), [saved]);
  const [cfg, setCfg] = useState<ScoresConfig>(seed.cfg);
  const [mix, setMix] = useState<EngineMix>(seed.mix);
  const [retrieval, setRetrieval] = useState<Retrieval>(seed.retrieval);
  const [promoVals, setPromoVals] = useState<PromoVals>(seed.promoVals);

  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const current: ScoringSettings = useMemo(
    () => ({
      v: 1,
      mix,
      retrieval,
      ww: {
        distanceHalfKm: cfg.distanceHalfKm,
        waitHalfH: cfg.waitHalfH,
        waitExp: cfg.waitExp,
        sessionH: cfg.sessionH,
      },
      promos: {
        zero: promoVals.zero,
        conservative: promoVals.conservative,
        aggressive: promoVals.aggressive,
        dominant: promoVals.dominant,
      },
    }),
    [mix, retrieval, cfg, promoVals],
  );

  const dirty = useMemo(
    () => JSON.stringify(current) !== JSON.stringify(saved),
    [current, saved],
  );

  const apply = (s: ScoringSettings) => {
    const f = fromSettings(s);
    setCfg(f.cfg);
    setMix(f.mix);
    setRetrieval(f.retrieval);
    setPromoVals(f.promoVals);
  };

  const save = () => {
    setSaveError(null);
    setSavedOk(false);
    startSave(async () => {
      const r = await updateScoringSettings(current);
      if (!r.ok) {
        setSaveError(r.error);
        return;
      }
      const clean = coerceScoringSettings(r.config);
      setSaved(clean);
      apply(clean);
      setSavedOk(true);
      window.setTimeout(() => setSavedOk(false), 2500);
    });
  };

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
        current,
        dirty,
        saving,
        saveError,
        savedOk,
        save,
        resetToDefaults: () => apply(DEFAULT_SCORING_SETTINGS),
        revert: () => apply(saved),
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
