"use client";

import { EmBox } from "./EmBox";
import { SmBox } from "./SmBox";
import { GpBox } from "./GpBox";
import { RpBox } from "./RpBox";
import { XxBox } from "./XxBox";
import { MpBox } from "./MpBox";

// Subscores — TUNE, nothing else: composition ONLY. One file per subscore
// (EmBox · SmBox · GpBox · RpBox · XxBox), every box rendered through the
// SubscoreBox shell, which ENFORCES the five-part anatomy (Overview ·
// Hyperparams · Inputs · Process · Outputs — Pato 2026-07-21), the
// per-subscore tint (sky · emerald · amber · rose · violet), the anchor id
// and the per-box save bar. Values set in any box drive the Scores tab's
// live definitions and both playgrounds (shared provider) and persist to
// app_settings.scoring_config.

export function SubscoresPanel() {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <EmBox />
      <SmBox />
      <GpBox />
      <RpBox />
      <MpBox />
      <XxBox />
    </div>
  );
}
