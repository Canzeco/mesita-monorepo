"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import {
  coerceScoringSettings,
  DEFAULT_SCORING_SETTINGS,
  LANE_N_MAX,
  type ContextConfig,
  type EmParams,
  type GpParams,
  type RpRungs,
  type ScoringSettings,
  type SmParams,
  type XxParams,
} from "@/lib/business/scores";
import type { SampleConsumer, SamplePlace } from "@/lib/business/cip";
import { updateScoringSettings } from "./settings-actions";

// Shared state for the Scoring Config tabs (v10 blob). The layout mounts
// this ONCE, so knobs set on Subscores carry into Scores & Lanes live and
// survive tab switches — both playgrounds compute from the SAME form state.
// The DB sample flows through as plain props; the SAVED settings blob seeds
// the knobs on first mount (null in DB = code defaults).
//
// Save = whole-blob write to app_settings.scoring_config via the EF pair.
// Reset-to-defaults = load DEFAULT_SCORING_SETTINGS into the form (dirty
// until saved). Revert = the form back to the last-saved values.

function fromSettings(s: ScoringSettings): {
  laneN: number;
  recallTopK: number;
  em: EmParams;
  sm: SmParams;
  gp: GpParams;
  rp: RpRungs;
  xx: XxParams;
  context: ContextConfig;
} {
  return {
    laneN: s.laneN,
    recallTopK: s.retrieval.recallTopK,
    em: { ...s.em },
    sm: { where: { ...s.sm.where }, when: { ...s.sm.when }, what: { ...s.sm.what } },
    gp: { ...s.gp },
    rp: { ...s.rp },
    xx: { ...s.xx },
    context: { em: [...s.context.em] },
  };
}

type ScoringCtx = {
  consumers: SampleConsumer[];
  places: SamplePlace[];
  /** Shared lane length N — every lane contributes up to N cards. */
  laneN: number;
  setLaneN: (n: number) => void;
  recallTopK: number;
  setRecallTopK: (n: number) => void;
  em: EmParams;
  setEm: React.Dispatch<React.SetStateAction<EmParams>>;
  sm: SmParams;
  setSm: React.Dispatch<React.SetStateAction<SmParams>>;
  gp: GpParams;
  setGp: React.Dispatch<React.SetStateAction<GpParams>>;
  rp: RpRungs;
  setRp: React.Dispatch<React.SetStateAction<RpRungs>>;
  xx: XxParams;
  setXx: React.Dispatch<React.SetStateAction<XxParams>>;
  /** Which fields EM reads — the configurable pipeline. */
  context: ContextConfig;
  toggleContext: (key: string) => void;
  /** Current form as a settings blob. */
  current: ScoringSettings;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  savedOk: boolean;
  save: () => void;
  resetToDefaults: () => void;
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
  const [laneN, setLaneNRaw] = useState<number>(seed.laneN);
  const [recallTopK, setRecallTopKRaw] = useState<number>(seed.recallTopK);
  const [em, setEm] = useState<EmParams>(seed.em);
  const [sm, setSm] = useState<SmParams>(seed.sm);
  const [gp, setGp] = useState<GpParams>(seed.gp);
  const [rp, setRp] = useState<RpRungs>(seed.rp);
  const [xx, setXx] = useState<XxParams>(seed.xx);
  const [context, setContext] = useState<ContextConfig>(seed.context);

  const setLaneN = (n: number) =>
    setLaneNRaw(Math.max(1, Math.min(LANE_N_MAX, Math.round(Number.isFinite(n) ? n : 1))));
  const setRecallTopK = (n: number) =>
    setRecallTopKRaw(Math.max(10, Math.min(200, Math.round(Number.isFinite(n) ? n : 10))));

  const toggleContext = (key: string) =>
    setContext((c) => ({
      em: c.em.includes(key) ? c.em.filter((k) => k !== key) : [...c.em, key],
    }));

  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // Literal-constructed in the SAME key order coerceScoringSettings outputs —
  // the dirty diff is JSON.stringify equality.
  const current: ScoringSettings = useMemo(
    () => ({
      v: 4,
      laneN,
      retrieval: { recallTopK },
      em: { embedDims: em.embedDims },
      sm: {
        where: {
          pointTolKm: sm.where.pointTolKm,
          zoneSpillKm: sm.where.zoneSpillKm,
          distExp: sm.where.distExp,
        },
        when: {
          waitFloor: sm.when.waitFloor,
          waitTransitionH: sm.when.waitTransitionH,
          waitSteep: sm.when.waitSteep,
          sessionH: sm.when.sessionH,
          timeBlockH: sm.when.timeBlockH,
        },
        what: { sibling: sm.what.sibling, mismatch: sm.what.mismatch },
      },
      gp: { lnCeiling: gp.lnCeiling },
      rp: {
        zero: rp.zero,
        conservative: rp.conservative,
        aggressive: rp.aggressive,
        dominant: rp.dominant,
      },
      xx: { control: xx.control },
      // Sorted so toggle order never fakes a diff against the saved blob.
      context: { em: [...context.em].sort() },
    }),
    [laneN, recallTopK, em, sm, gp, rp, xx, context],
  );

  const dirty = useMemo(
    () => JSON.stringify(current) !== JSON.stringify(saved),
    [current, saved],
  );

  const apply = (s: ScoringSettings) => {
    const f = fromSettings(s);
    setLaneNRaw(f.laneN);
    setRecallTopKRaw(f.recallTopK);
    setEm(f.em);
    setSm(f.sm);
    setGp(f.gp);
    setRp(f.rp);
    setXx(f.xx);
    setContext(f.context);
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
        laneN,
        setLaneN,
        recallTopK,
        setRecallTopK,
        em,
        setEm,
        sm,
        setSm,
        gp,
        setGp,
        rp,
        setRp,
        xx,
        setXx,
        context,
        toggleContext,
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
