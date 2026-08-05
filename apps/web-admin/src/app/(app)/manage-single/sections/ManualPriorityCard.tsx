"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { DEFAULT_MANUAL_PRIORITY } from "@/lib/business/scores";
import { updatePlace, type AdminPlace } from "../actions";
import { useUnitPlace } from "../UnitPlaceContext";
import { GroupLabel, SectionCard } from "../ui";

// Manual Priority — the one LIVE, editable per-place score (MP subscore). A
// self-contained card (its own save, independent of the Place form's per-box
// flow): the super-admin bumps this place's operator priority and Swipe & Map
// move on save. Default 0.1 for every untouched place. Lives on the Admin tab
// — a business must never see its own thumb-on-the-scale. Written via
// business-web-update-project → super-admin-gated → places.manual_priority.
export function ManualPriorityCard({ place }: { place: AdminPlace }) {
  const { setPlace } = useUnitPlace();
  const [mp, setMp] = useState(place.manual_priority ?? DEFAULT_MANUAL_PRIORITY);
  const [savedMp, setSavedMp] = useState(place.manual_priority ?? DEFAULT_MANUAL_PRIORITY);
  const [saving, startSave] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const dirty = Math.abs(mp - savedMp) > 1e-9;

  const save = () => {
    setErr(null);
    startSave(async () => {
      const r = await updatePlace({ id: place.id, manual_priority: mp });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setSavedMp(r.data.manual_priority ?? mp);
      // Keep Scores (and any other place readers) in sync without a reload.
      setPlace(r.data);
    });
  };

  return (
    <SectionCard
      icon={<Star className="h-4.5 w-4.5" />}
      tint="teal"
      title="Manual Priority"
      subtitle="Your thumb on the scale for THIS place — an operator priority in [0,1] that multiplies both Lineup lanes (Organic · Inorganic). Saving moves Swipe & Map live. Default 0.1; raise it to surface the place."
    >
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <GroupLabel>Priority · multiplies both lanes</GroupLabel>
        <span className="font-display text-2xl font-semibold tabular-nums">{mp.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={mp}
        onChange={(e) => setMp(Number(e.target.value))}
        aria-label="Manual Priority"
        className="mt-2 w-full accent-teal-600"
        disabled={saving}
      />
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-[11px] leading-snug">
          {mp === DEFAULT_MANUAL_PRIORITY
            ? "At the 0.1 baseline — scaled like every untouched place."
            : mp === 0
              ? "0 — buries this place in every lane."
              : `Prioritized ${(mp / DEFAULT_MANUAL_PRIORITY).toFixed(1)}× above the baseline.`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {err ? <span className="text-[11px] font-medium text-red-600">{err}</span> : null}
          {!dirty && !saving ? (
            <span className="text-muted-foreground text-[11px]">saved ✓</span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="bg-pink-gradient shadow-save inline-flex h-8 items-center rounded-full px-4 text-[13px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save priority"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
