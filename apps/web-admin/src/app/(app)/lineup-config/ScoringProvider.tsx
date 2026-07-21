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

// Shared state for the Lineup Config tabs (v10 blob). The layout mounts
// this ONCE, so knobs set on Subscores carry into Scores & Lanes live and
// survive tab switches — both playgrounds compute from the SAME form state.
//
// SAVE IS PER-BOX (Pato 2026-07-16: "each individual box must have its own
// save changes / cancel button, not for the whole page"). Each box owns a
// SECTION of the blob; its Save merges THAT section's live values over the
// last-saved blob and writes the WHOLE blob (the EF's whole-blob contract is
// unchanged — partial patches would invite drift). Its Cancel reverts only
// that section. Other boxes' unsaved edits are never swept along.

// Each subscore box owns its section: knobs + its OWN data-access row (folded
// in 2026-07-17 — the standalone data-access matrix box is gone). No separate
// "dataAccess" section any more.
export type SettingsSection =
  | "em" // EM's field context + EM's data-access row
  | "sm"
  | "gp"
  | "rp"
  | "xx"
  | "lanes"; // laneN — lives on the Scores & Lanes page

function fromSettings(s: ScoringSettings): {
  laneN: LaneCounts;
  sm: SmParams;
  gp: GpParams;
  rp: RpRungs;
  xx: XxParams;
  dataAccess: DataAccess;
  context: ContextConfig;
} {
  return {
    laneN: { ...s.laneN },
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
  sm: SmParams;
  setSm: React.Dispatch<React.SetStateAction<SmParams>>;
  gp: GpParams;
  setGp: React.Dispatch<React.SetStateAction<GpParams>>;
  rp: RpRungs;
  setRp: React.Dispatch<React.SetStateAction<RpRungs>>;
  /** XX — the DEFAULT control: the consumer's Randomness filter overrides
   * it per query; this is what Lineup uses with no filter set. */
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
  /** Load ONE box's code defaults into the form (dirty until its Save). */
  resetSection: (section: SettingsSection) => void;
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
      v: 9,
      // Same key order as coerceLaneCounts' output — the dirty diff is
      // JSON.stringify equality.
      laneN: {
        organic: laneN.organic,
        inorganic: laneN.inorganic,
        hybrid: laneN.hybrid,
      },
      sm: {
        where: { defaultTolKm: sm.where.defaultTolKm, distExp: sm.where.distExp },
        when: { waitFloor: sm.when.waitFloor, sessionH: sm.when.sessionH },
        what: { sibling: sm.what.sibling },
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
    [laneN, sm, gp, rp, xx, dataAccess, context],
  );

  // A section's slice of a blob — the unit of dirty/save/revert. Each subscore
  // section carries its OWN data-access row, so a box saves its knobs and its
  // sources together.
  const slice = (s: ScoringSettings, section: SettingsSection): unknown => {
    switch (section) {
      case "em":
        return { em: s.context.em, da: s.dataAccess.em };
      case "sm":
        return { sm: s.sm, da: s.dataAccess.sm };
      case "gp":
        return { gp: s.gp, da: s.dataAccess.gp };
      case "rp":
        return { rp: s.rp, da: s.dataAccess.rp };
      case "xx":
        return { xx: s.xx, da: s.dataAccess.xx };
      case "lanes":
        return s.laneN;
    }
  };

  const SECTIONS: readonly SettingsSection[] = ["em", "sm", "gp", "rp", "xx", "lanes"];

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
  // boxes' unsaved edits are never swept along by someone else's Save. A
  // subscore section also carries its OWN data-access cell over saved's matrix.
  const withDa = (sub: SubscoreId): DataAccess => ({
    ...saved.dataAccess,
    [sub]: current.dataAccess[sub],
  });
  const blobFor = (section: SettingsSection): ScoringSettings => {
    switch (section) {
      case "em":
        return { ...saved, context: current.context, dataAccess: withDa("em") };
      case "sm":
        return { ...saved, sm: current.sm, dataAccess: withDa("sm") };
      case "gp":
        return { ...saved, gp: current.gp, dataAccess: withDa("gp") };
      case "rp":
        return { ...saved, rp: current.rp, dataAccess: withDa("rp") };
      case "xx":
        return { ...saved, xx: current.xx, dataAccess: withDa("xx") };
      case "lanes":
        return { ...saved, laneN: current.laneN };
    }
  };

  // Re-apply ONE section from a blob into the form (post-save clamp echo,
  // or a Cancel). Each subscore section also restores its own data-access cell.
  const setDaCell = (f: DataAccess, sub: SubscoreId) =>
    setDataAccess((da) => ({ ...da, [sub]: [...f[sub]] }));
  const applySection = (s: ScoringSettings, section: SettingsSection) => {
    const f = fromSettings(s);
    switch (section) {
      case "em":
        setContext(f.context);
        setDaCell(f.dataAccess, "em");
        return;
      case "sm":
        setSm(f.sm);
        setDaCell(f.dataAccess, "sm");
        return;
      case "gp":
        setGp(f.gp);
        setDaCell(f.dataAccess, "gp");
        return;
      case "rp":
        setRp(f.rp);
        setDaCell(f.dataAccess, "rp");
        return;
      case "xx":
        setXx(f.xx);
        setDaCell(f.dataAccess, "xx");
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

  // Per-box Reset: load THIS box's code defaults into the form (dirty until
  // its own Save). Other boxes are untouched — the old whole-form
  // resetToDefaults is gone (every box owns its Reset now).
  const resetSection = (section: SettingsSection) =>
    applySection(DEFAULT_SCORING_SETTINGS, section);

  return (
    <Ctx.Provider
      value={{
        consumers,
        places,
        laneN,
        setLaneN,
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
        resetSection,
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
