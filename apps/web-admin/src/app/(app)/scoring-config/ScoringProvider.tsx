"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import {
  coerceScoringSettings,
  DEFAULT_SCORES_CONFIG,
  DEFAULT_SCORING_SETTINGS,
  type ContextConfig,
  type EngineId,
  type FmParams,
  type LaneId,
  type MatchTierId,
  type ScoresConfig,
  type ScoringSettings,
  type SmParams,
} from "@/lib/business/scores";
import { type StrategyId } from "@/lib/business/strategies";
import type { SampleConsumer, SamplePlace } from "@/lib/business/cip";
import { updateScoringSettings } from "./settings-actions";

// Shared state for the Scoring Config tabs. The layout mounts this ONCE, so
// knobs set on Pipeline carry into Internals and Engines live and survive tab
// switches. The DB sample flows through as plain props; the SAVED settings
// blob seeds the knobs on first mount (null in DB = code defaults).
//
// Save = whole-blob write to app_settings.scoring_config via the EF pair.
// Reset-to-defaults = load DEFAULT_SCORING_SETTINGS into the form (dirty
// until saved). Cancel = revert the form to the last-saved values.

type EngineMix = Record<EngineId, Record<LaneId, number>>;
type Retrieval = ScoringSettings["retrieval"];
type BpVals = Record<StrategyId, number>;

function fromSettings(s: ScoringSettings): {
  cfg: ScoresConfig;
  mix: EngineMix;
  retrieval: Retrieval;
  bpVals: BpVals;
  context: ContextConfig;
  fmParams: FmParams;
  smParams: SmParams;
} {
  return {
    cfg: { ...DEFAULT_SCORES_CONFIG, ...s.www },
    mix: s.mix,
    retrieval: s.retrieval,
    bpVals: { ...s.bp },
    context: { fm: [...s.context.fm], sm: [...s.context.sm] },
    fmParams: { ...s.fm },
    smParams: { ...s.sm },
  };
}

type ScoringCtx = {
  consumers: SampleConsumer[];
  places: SamplePlace[];
  /** WWW's knobs. */
  cfg: ScoresConfig;
  setCfg: React.Dispatch<React.SetStateAction<ScoresConfig>>;
  mix: EngineMix;
  setMix: React.Dispatch<React.SetStateAction<EngineMix>>;
  retrieval: Retrieval;
  setRetrieval: React.Dispatch<React.SetStateAction<Retrieval>>;
  /** BP — the rung each posture earns. */
  bpVals: BpVals;
  setBpVals: React.Dispatch<React.SetStateAction<BpVals>>;
  /** Which fields each match tier reads — the configurable pipeline. */
  context: ContextConfig;
  /** Toggle one registry field in one tier's context. */
  toggleContext: (tier: MatchTierId, key: string) => void;
  /** FM internals — the encoder's params. */
  fmParams: FmParams;
  setFmParams: React.Dispatch<React.SetStateAction<FmParams>>;
  /** SM internals — the judge's rubric weights. */
  smParams: SmParams;
  setSmParams: React.Dispatch<React.SetStateAction<SmParams>>;
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
  const [bpVals, setBpVals] = useState<BpVals>(seed.bpVals);
  const [context, setContext] = useState<ContextConfig>(seed.context);
  const [fmParams, setFmParams] = useState<FmParams>(seed.fmParams);
  const [smParams, setSmParams] = useState<SmParams>(seed.smParams);

  const toggleContext = (tier: MatchTierId, key: string) =>
    setContext((c) => ({
      ...c,
      [tier]: c[tier].includes(key) ? c[tier].filter((k) => k !== key) : [...c[tier], key],
    }));

  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const current: ScoringSettings = useMemo(
    () => ({
      v: 1,
      mix,
      retrieval,
      www: { ...cfg },
      bp: {
        zero: bpVals.zero,
        conservative: bpVals.conservative,
        aggressive: bpVals.aggressive,
        dominant: bpVals.dominant,
      },
      // Sorted so toggle order never fakes a diff against the saved blob.
      context: { fm: [...context.fm].sort(), sm: [...context.sm].sort() },
      fm: { ...fmParams },
      sm: { ...smParams },
    }),
    [mix, retrieval, cfg, bpVals, context, fmParams, smParams],
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
    setBpVals(f.bpVals);
    setContext(f.context);
    setFmParams(f.fmParams);
    setSmParams(f.smParams);
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
        bpVals,
        setBpVals,
        context,
        toggleContext,
        fmParams,
        setFmParams,
        smParams,
        setSmParams,
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
