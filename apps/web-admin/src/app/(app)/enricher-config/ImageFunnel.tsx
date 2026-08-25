"use client";

import type { ReactNode } from "react";
import { ArrowRight, Image as ImageIcon, Instagram } from "lucide-react";
import { Switch } from "@/components/admin-ui/config";
import {
  MAX_GOOGLE_COLLECT,
  MAX_INSTAGRAM_COLLECT,
  MAX_SAVE_IMAGES,
  type IntakeSettings,
} from "./intake-guards";

/**
 * Images knobs as two source funnels, not a 7-card grid.
 * Instagram: last X newest → rank by likes → vision the top Y.
 * Google: already ranked by Places → vision the top Y.
 * The likes-keep blob field follows Y on save (no third IG number).
 */
export function ImageFunnel({
  settings,
  pending,
  onPatch,
}: {
  settings: IntakeSettings;
  pending: boolean;
  onPatch: (next: Partial<IntakeSettings>) => void;
}) {
  const visionOff = !settings.imageVisionEnabled;
  return (
    <div className="space-y-3">
      <SourceRow
        icon={<Instagram className="h-4 w-4" aria-hidden />}
        name="Instagram"
        hint="Apify returns newest first. We rank that window by likes, then vision the top Y."
      >
        <FunnelNum
          label="Last"
          suffix="newest"
          value={settings.gatherInstagramDepth}
          min={1}
          max={MAX_INSTAGRAM_COLLECT}
          disabled={pending}
          ariaLabel="Instagram last newest posts to collect"
          onChange={(v) => onPatch({ gatherInstagramDepth: v })}
        />
        <Step>rank by likes</Step>
        <FunnelNum
          label="Vision"
          suffix="top"
          value={settings.analyzeInstagramImages}
          min={1}
          max={settings.gatherInstagramDepth}
          disabled={pending || visionOff}
          ariaLabel="Instagram posts to describe with vision"
          onChange={(v) => onPatch({ analyzeInstagramImages: v })}
        />
      </SourceRow>

      <SourceRow
        icon={<ImageIcon className="h-4 w-4" aria-hidden />}
        name="Google"
        hint="Places photos already come best-first. There is no likes step."
      >
        <FunnelNum
          label="Take"
          suffix="ranked"
          value={settings.gatherGoogleImages}
          min={1}
          max={MAX_GOOGLE_COLLECT}
          disabled={pending}
          ariaLabel="Google photos to collect"
          onChange={(v) => onPatch({ gatherGoogleImages: v })}
        />
        <Step>already ranked</Step>
        <FunnelNum
          label="Vision"
          suffix="top"
          value={settings.analyzeGoogleImages}
          min={1}
          max={settings.gatherGoogleImages}
          disabled={pending || visionOff}
          ariaLabel="Google photos to describe with vision"
          onChange={(v) => onPatch({ analyzeGoogleImages: v })}
        />
      </SourceRow>

      <div className="border-border bg-background flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border px-4 py-3">
        <FunnelNum
          label="Keep"
          suffix="on profile"
          value={settings.saveTotalImages}
          min={1}
          max={Math.min(
            MAX_SAVE_IMAGES,
            settings.analyzeGoogleImages + settings.analyzeInstagramImages,
          )}
          disabled={pending}
          ariaLabel="Photos kept on the profile"
          onChange={(v) => onPatch({ saveTotalImages: v })}
        />
        <label className="ml-auto flex items-center gap-2">
          <span className="text-sm font-medium">Vision</span>
          <Switch
            on={settings.imageVisionEnabled}
            pending={pending}
            label="Toggle image vision"
            onClick={() =>
              onPatch({ imageVisionEnabled: !settings.imageVisionEnabled })
            }
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">Mirror</span>
          <Switch
            on={settings.saveImagesToStorage}
            pending={pending}
            label="Toggle image storage"
            onClick={() =>
              onPatch({ saveImagesToStorage: !settings.saveImagesToStorage })
            }
          />
        </label>
      </div>
    </div>
  );
}

function SourceRow({
  icon,
  name,
  hint,
  children,
}: {
  icon: ReactNode;
  name: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-background rounded-xl border px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {name}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{hint}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">{children}</div>
    </div>
  );
}

function Step({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground mb-2 inline-flex items-center gap-1 px-1 text-xs">
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}

function FunnelNum({
  label,
  suffix,
  value,
  min,
  max,
  disabled,
  ariaLabel,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  ariaLabel: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground type-label font-semibold tracking-[0.12em] uppercase">
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (Number.isNaN(raw)) return;
            onChange(Math.max(min, Math.min(max, Math.round(raw))));
          }}
          className="border-border bg-card focus:border-foreground h-9 w-14 rounded-lg border px-2 text-right text-sm tabular-nums outline-none disabled:opacity-50"
        />
        <span className="text-muted-foreground text-xs">{suffix}</span>
      </span>
    </label>
  );
}
