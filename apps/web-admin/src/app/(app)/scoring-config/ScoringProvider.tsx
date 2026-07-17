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
  type LaneCounts,
  type LaneId,
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
//
// SAVE IS PER-BOX (Pato 2026-07-16: "each individual box must have its own
// save changes / cancel button, not for the whole page"). Each box owns a
// SECTION of the blob; its Save merges THAT section's live values over the
// last-saved blob and writes the WHOLE blob (the EF's whole-blob contract is
// unchanged — partial patches would invite drift). Its Cancel reverts only
// that section. Other boxes' unsaved edits are never swept along.

export type SettingsSection =
  | "dataAccess"
  | "em" // recall top-K + EM's field context (the EM box's two configs)
  | "sm"
  | "gp"
  | "rp"
  | "xx"
  | "lanes"; // laneN — lives on the Scores & Lanes page

function fromSettings(s: ScoringSettings): {
  laneN: LaneCounts;
  recallTopK: number;
  sm: SmParams;
  gp: GpParams;
  rp: RpRungs;
  xx: XxParams;
  dataAccess: DataAccess;
  context: ContextConfig;
} {
  return {
    laneN: { ...s.laneN },
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
  /** Per-lane deck counts — how many cards each lane may contribute. */
  laneN: LaneCounts;
  setLaneN: (lane: LaneId, n: number) => void;
  recallTopK: number;
  setRecallTopK: (n: number) => void;
  sm: SmParams;
  setSm: React.Dispatch<React.SetStateAction<SmParams>>;
  gp: GpParams;
  setGp: React.Dispatch<React.SetStateAction<GpParams>>;
  rp: RpRungs;
  setRp: React.Dispatch<React.SetStateAction<RpRungs>>;
  /** XX — the DEFAULT control: the consumer's Randomness filter overrides
   * it per query; this is what the Standard Engine uses with no filter set. */
  xx: XxParams;
  setXx: React.Dispatch<React.SetStateAction<XxParams>>;
  /** The core config — per-subscore source toggles (the data-access matrix). */
  dataAccess: DataAccess;
  toggleSource: (subscore: SubscoreId, source: DataSourceId) => void;
  /** Which fields EM reads — the per-field detail under the matrix. */
  context: ContextConfig;
  toggleContext: (key: string) => void;
  /** Current form as a settings blob (the playgrounds compute from this). */
  current: ScoringSettings;
  /** Per-section dirty flags — each box renders its own Save/Cancel. */
  sectionDirty: Record<SettingsSection, boolean>;
  /** The section currently being saved, if any. */
  savingSection: SettingsSection | null;
  saveError: string | null;
  /** The section whose save just landed (transient ✓). */
  savedSection: SettingsSection | null;
  saveSection: (section: SettingsSection) => void;
  revertSection: (section: SettingsSection) => void;
  /** Load code defaults into the whole form (each box dirty until saved). */
  resetToDefaults: () => void;
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
  const [laneN, setLaneNRaw] = useState<LaneCounts>(seed.laneN);
  const [recallTopK, setRecallTopKRaw] = useState<number>(seed.recallTopK);
  const [sm, setSm] = useState<SmParams>(seed.sm);
  const [gp, setGp] = useState<GpParams>(seed.gp);
  const [rp, setRp] = useState<RpRungs>(seed.rp);
  const [xx, setXx] = useState<XxParams>(seed.xx);
  const [dataAccess, setDataAccess] = useState<DataAccess>(seed.dataAccess);
  const [context, setContext] = useState<ContextConfig>(seed.context);

  // Per-lane, 0 allowed (lane off) — the EF rejects an all-zero save.
  const setLaneN = (lane: LaneId, n: number) =>
    setLaneNRaw((c) => ({
      ...c,
      [lane]: Math.max(0, Math.min(LANE_N_MAX, Math.round(Number.isFinite(n) ? n : 0))),
    }));
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

  const [savingSection, setSavingSection] = useState<SettingsSection | null>(null);
  const [, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<SettingsSection | null>(null);

  // Literal-constructed in the SAME key order coerceScoringSettings outputs —
  // dirty diffs are JSON.stringify equality per section.
  const current: ScoringSettings = useMemo(
    () => ({
      v: 5,
      // Same key order as coerceLaneCounts' output — the dirty diff is
      // JSON.stringify equality.
      laneN: {
        organic: laneN.organic,
        inorganic: laneN.inorganic,
        hybrid: laneN.hybrid,
      },
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

  // A section's slice of a blob — the unit of dirty/save/revert.
  const slice = (s: ScoringSettings, section: SettingsSection): unknown => {
    switch (section) {
      case "dataAccess":
        return s.dataAccess;
      case "em":
        return { recallTopK: s.retrieval.recallTopK, em: s.context.em };
      case "sm":
        return s.sm;
      case "gp":
        return s.gp;
      case "rp":
        return s.rp;
      case "xx":
        return s.xx;
      case "lanes":
        return s.laneN;
    }
  };

  const SECTIONS: readonly SettingsSection[] = [
    "dataAccess",
    "em",
    "sm",
    "gp",
    "rp",
    "xx",
    "lanes",
  ];

  const sectionDirty = useMemo(
    () =>
      Object.fromEntries(
        SECTIONS.map((sec) => [
          sec,
          JSON.stringify(slice(current, sec)) !== JSON.stringify(slice(saved, sec)),
        ]),
      ) as Record<SettingsSection, boolean>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, saved],
  );

  // THIS section's live values merged over the last-saved blob — other
  // boxes' unsaved edits are never swept along by someone else's Save.
  const blobFor = (section: SettingsSection): ScoringSettings => {
    switch (section) {
      case "dataAccess":
        return { ...saved, dataAccess: current.dataAccess };
      case "em":
        return { ...saved, retrieval: current.retrieval, context: current.context };
      case "sm":
        return { ...saved, sm: current.sm };
      case "gp":
        return { ...saved, gp: current.gp };
      case "rp":
        return { ...saved, rp: current.rp };
      case "xx":
        return { ...saved, xx: current.xx };
      case "lanes":
        return { ...saved, laneN: current.laneN };
    }
  };

  // Re-apply ONE section from a blob into the form (post-save clamp echo,
  // or a Cancel).
  const applySection = (s: ScoringSettings, section: SettingsSection) => {
    const f = fromSettings(s);
    switch (section) {
      case "dataAccess":
        setDataAccess(f.dataAccess);
        return;
      case "em":
        setRecallTopKRaw(f.recallTopK);
        setContext(f.context);
        return;
      case "sm":
        setSm(f.sm);
        return;
      case "gp":
        setGp(f.gp);
        return;
      case "rp":
        setRp(f.rp);
        return;
      case "xx":
        setXx(f.xx);
        return;
      case "lanes":
        setLaneNRaw(f.laneN);
        return;
    }
  };

  const saveSection = (section: SettingsSection) => {
    setSaveError(null);
    setSavedSection(null);
    setSavingSection(section);
    startSave(async () => {
      const r = await updateScoringSettings(blobFor(section));
      setSavingSection(null);
      if (!r.ok) {
        setSaveError(r.error);
        return;
      }
      const clean = coerceScoringSettings(r.config);
      setSaved(clean);
      applySection(clean, section);
      setSavedSection(section);
      window.setTimeout(() => setSavedSection(null), 2500);
    });
  };

  const revertSection = (section: SettingsSection) => applySection(saved, section);

  const resetToDefaults = () => {
    const f = fromSettings(DEFAULT_SCORING_SETTINGS);
    setLaneNRaw(f.laneN);
    setRecallTopKRaw(f.recallTopK);
    setSm(f.sm);
    setGp(f.gp);
    setRp(f.rp);
    setXx(f.xx);
    setDataAccess(f.dataAccess);
    setContext(f.context);
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
        sectionDirty,
        savingSection,
        saveError,
        savedSection,
        saveSection,
        revertSection,
        resetToDefaults,
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
