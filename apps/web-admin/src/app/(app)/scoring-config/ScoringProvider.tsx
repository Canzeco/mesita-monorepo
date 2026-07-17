"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import {
  APPLICABLE_SOURCES,
  coerceScoringSettings,
  DEFAULT_SCORING_SETTINGS,
  LANE_N_MAX,
  SUBSCORES,
  type ContextConfig,
  type DataAccess,
  type DataSourceId,
  type GpParams,
  type RpRungs,
  type ScoringSettings,
  type SmParams,
  type SubscoreId,
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
  sm: SmParams;
  gp: GpParams;
  rp: RpRungs;
  xx: XxParams;
  dataAccess: DataAccess;
  context: ContextConfig;
} {
  return {
    laneN: s.laneN,
    recallTopK: s.retrieval.recallTopK,
    sm: { where: { ...s.sm.where }, when: { ...s.sm.when }, what: { ...s.sm.what } },
    gp: { ...s.gp },
    rp: { ...s.rp },
    xx: { ...s.xx },
    dataAccess: Object.fromEntries(
      SUBSCORES.map((sub) => [sub.id, [...s.dataAccess[sub.id]]]),
    ) as DataAccess,
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
  sm: SmParams;
  setSm: React.Dispatch<React.SetStateAction<SmParams>>;
  gp: GpParams;
  setGp: React.Dispatch<React.SetStateAction<GpParams>>;
  rp: RpRungs;
  setRp: React.Dispatch<React.SetStateAction<RpRungs>>;
  xx: XxParams;
  setXx: React.Dispatch<React.SetStateAction<XxParams>>;
  /** The core config — per-subscore source toggles (the data-access matrix). */
  dataAccess: DataAccess;
  toggleSource: (subscore: SubscoreId, source: DataSourceId) => void;
  /** Which fields EM reads — the per-field detail under the matrix. */
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
  const [sm, setSm] = useState<SmParams>(seed.sm);
  const [gp, setGp] = useState<GpParams>(seed.gp);
  const [rp, setRp] = useState<RpRungs>(seed.rp);
  const [xx, setXx] = useState<XxParams>(seed.xx);
  const [dataAccess, setDataAccess] = useState<DataAccess>(seed.dataAccess);
  const [context, setContext] = useState<ContextConfig>(seed.context);

  const setLaneN = (n: number) =>
    setLaneNRaw(Math.max(1, Math.min(LANE_N_MAX, Math.round(Number.isFinite(n) ? n : 1))));
  const setRecallTopK = (n: number) =>
    setRecallTopKRaw(Math.max(10, Math.min(200, Math.round(Number.isFinite(n) ? n : 10))));

  const toggleContext = (key: string) =>
    setContext((c) => ({
      em: c.em.includes(key) ? c.em.filter((k) => k !== key) : [...c.em, key],
    }));

  const toggleSource = (subscore: SubscoreId, source: DataSourceId) =>
    setDataAccess((da) => {
      if (!APPLICABLE_SOURCES[subscore].includes(source)) return da;
      const cell = da[subscore];
      return {
        ...da,
        [subscore]: cell.includes(source)
          ? cell.filter((s) => s !== source)
          : [...cell, source],
      };
    });

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
      dataAccess: Object.fromEntries(
        SUBSCORES.map((sub) => [sub.id, [...dataAccess[sub.id]].sort()]),
      ) as DataAccess,
      context: { em: [...context.em].sort() },
    }),
    [laneN, recallTopK, sm, gp, rp, xx, dataAccess, context],
  );

  const dirty = useMemo(
    () => JSON.stringify(current) !== JSON.stringify(saved),
    [current, saved],
  );

  const apply = (s: ScoringSettings) => {
    const f = fromSettings(s);
    setLaneNRaw(f.laneN);
    setRecallTopKRaw(f.recallTopK);
    setSm(f.sm);
    setGp(f.gp);
    setRp(f.rp);
    setXx(f.xx);
    setDataAccess(f.dataAccess);
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
        sm,
        setSm,
        gp,
        setGp,
        rp,
        setRp,
        xx,
        setXx,
        dataAccess,
        toggleSource,
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
