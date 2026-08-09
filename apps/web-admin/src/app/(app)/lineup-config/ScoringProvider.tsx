"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import {
  coerceScoringSettings,
  DEFAULT_SCORING_SETTINGS,
  LANE_N_MAX,
  type GpParams,
  type LaneCounts,
  type LaneId,
  type RpRungs,
  type ScoringSettings,
  type SmParams,
  type XxParams,
} from "@/lib/business/scores";
import type { SampleConsumer, SamplePlace } from "@/lib/business/cip";
import { updateScoringSettings } from "./settings-actions";

// Shared state for the Lineup Config tabs (v12 blob). The layout mounts
// this ONCE, so knobs set on Subscores carry into Scores & Lanes live and
// survive tab switches — both playgrounds compute from the SAME form state.
//
// SAVE IS PER-BOX (Pato 2026-07-16: "each individual box must have its own
// save changes / cancel button, not for the whole page"). Each box owns a
// SECTION of the blob; its Save merges THAT section's live values over the
// last-saved blob and writes the WHOLE blob (the EF's whole-blob contract is
// unchanged — partial patches would invite drift). Its Cancel reverts only
// that section. Other boxes' unsaved edits are never swept along.

// Each subscore box owns its knobs' section. EM has NO section (v10): its
// encoder is a fixed decision, recall is gone, and inputs are documentation —
// nothing to save, so the EM box renders no save bar at all.
export type SettingsSection =
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
} {
  return {
    laneN: { ...s.laneN },
    sm: { where: { ...s.sm.where }, when: { ...s.sm.when }, what: { ...s.sm.what } },
    gp: { ...s.gp },
    rp: { ...s.rp },
    xx: { ...s.xx },
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
  /** XX — the control knob. Intended as a consumer-overridable default, but the
   * Randomness filter is not plumbed to the swipe/map EFs yet (MESITA-738), so
   * today this value applies to EVERY query, not just unfiltered ones. */
  xx: XxParams;
  setXx: React.Dispatch<React.SetStateAction<XxParams>>;
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
  /** Failed initial GET — Save stays blocked (MESITA-737). */
  loadError: string | null;
};

const Ctx = createContext<ScoringCtx | null>(null);

export function ScoringProvider({
  consumers,
  places,
  initialConfig,
  loadError = null,
  children,
}: {
  consumers: SampleConsumer[];
  places: SamplePlace[];
  /** Raw app_settings.scoring_config (null = code defaults). */
  initialConfig: unknown;
  /** When set, per-box Save stays disabled — never overwrite from a failed load. */
  loadError?: string | null;
  children: React.ReactNode;
}) {
  // Seed once from the saved blob; the provider persists across tab
  // navigation and router.refresh, so knobs never reset behind the operator.
  // When loadError is set this seed is code defaults only — Save is blocked.
  const [saved, setSaved] = useState<ScoringSettings>(() =>
    coerceScoringSettings(initialConfig),
  );
  const seed = useMemo(() => fromSettings(saved), [saved]);
  const [laneN, setLaneNRaw] = useState<LaneCounts>(seed.laneN);
  const [sm, setSm] = useState<SmParams>(seed.sm);
  const [gp, setGp] = useState<GpParams>(seed.gp);
  const [rp, setRp] = useState<RpRungs>(seed.rp);
  const [xx, setXx] = useState<XxParams>(seed.xx);

  // Per-lane, 0 allowed (lane off) — the EF rejects an all-zero save.
  const setLaneN = (lane: LaneId, n: number) =>
    setLaneNRaw((c) => ({
      ...c,
      [lane]: Math.max(0, Math.min(LANE_N_MAX, Math.round(Number.isFinite(n) ? n : 0))),
    }));

  const [savingSection, setSavingSection] = useState<SettingsSection | null>(null);
  const [, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<SettingsSection | null>(null);

  // Literal-constructed in the SAME key order coerceScoringSettings outputs —
  // dirty diffs are JSON.stringify equality per section.
  const current: ScoringSettings = useMemo(
    () => ({
      v: 12,
      // Same key order as coerceLaneCounts' output — the dirty diff is
      // JSON.stringify equality.
      laneN: {
        organic: laneN.organic,
        inorganic: laneN.inorganic,
      },
      sm: {
        where: { defaultTolKm: sm.where.defaultTolKm },
        when: { patience: sm.when.patience },
        what: { tol: sm.what.tol },
      },
      gp: { lnCeiling: gp.lnCeiling, ratingPow: gp.ratingPow },
      rp: {
        zero: rp.zero,
        conservative: rp.conservative,
        aggressive: rp.aggressive,
      },
      xx: { control: xx.control },
    }),
    [laneN, sm, gp, rp, xx],
  );

  // A section's slice of a blob — the unit of dirty/save/revert.
  const slice = (s: ScoringSettings, section: SettingsSection): unknown => {
    switch (section) {
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

  const SECTIONS: readonly SettingsSection[] = ["sm", "gp", "rp", "xx", "lanes"];

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
    if (loadError) return;
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
        current,
        sectionDirty,
        savingSection,
        saveError,
        savedSection,
        saveSection,
        revertSection,
        resetSection,
        loadError: loadError ?? null,
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
