"use client";

import { useState } from "react";
import {
  Brain,
  Clock,
  DollarSign,
  Eye,
  Globe,
  Instagram,
  Layers,
} from "lucide-react";
import type { SynthesisQuality } from "./actions";
import {
  Collapsible,
  NumberField,
  QualityPicker,
  SectionCard,
  Switch,
} from "./atlas-ui";
import {
  computeEnrichmentCost,
  fmtTime,
  money,
  STAGE_META,
  type CostLine,
} from "./cost-model";

// ─── Cost estimate ───────────────────────────────────────────────────────

function CalcPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <h3 className="text-muted-foreground mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function CalcStepper({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1.5 ${disabled ? "opacity-40" : ""}`}
    >
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={dec}
          aria-label={`Decrease ${label}`}
          className="border-border bg-background hover:border-foreground/40 flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition disabled:opacity-40"
        >
          −
        </button>
        <span className="w-9 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={inc}
          aria-label={`Increase ${label}`}
          className="border-border bg-background hover:border-foreground/40 flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  desc,
  control,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-border bg-card rounded-2xl border p-4 sm:p-6 ${className ?? ""}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-display text-base font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            {desc}
          </p>
        </div>
        {control}
      </div>
    </section>
  );
}

function CalculatorView({
  quality,
  setQuality,
  imageModel,
  setImageModel,
  vision,
  setVision,
  g,
  setG,
  ig,
  setIg,
  places,
  setPlaces,
  active,
  lines,
  perPlace,
  total,
  perPlaceSecs,
  totalSecs,
}: {
  quality: SynthesisQuality;
  setQuality: (q: SynthesisQuality) => void;
  imageModel: SynthesisQuality;
  setImageModel: (q: SynthesisQuality) => void;
  vision: boolean;
  setVision: (v: boolean) => void;
  g: number;
  setG: (v: number) => void;
  ig: number;
  setIg: (v: number) => void;
  places: number;
  setPlaces: (v: number) => void;
  active: CostLine[];
  lines: CostLine[];
  perPlace: number;
  total: number;
  perPlaceSecs: number;
  totalSecs: number;
}) {
  const stages = (["pre", "gather", "post"] as const).filter((stage) =>
    lines.some((l) => l.stage === stage && l.active),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm leading-relaxed">
        Estimate cost and runtime for enriching a new place. Every pipeline step
        S1→S9 always runs — adjust the model and image knobs to compare
        configurations. Figures are approximate, not billing.
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-start">
        <aside className="flex flex-col gap-4">
          <CalcPanel title="Models" icon={<Brain className="h-3.5 w-3.5" />}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Profile text</span>
                <QualityPicker value={quality} onChange={setQuality} />
              </div>
              <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
                <span className="text-sm">Photo analysis</span>
                <Switch
                  on={vision}
                  pending={false}
                  onClick={() => setVision(!vision)}
                  label="Toggle photo analysis"
                />
              </div>
              {vision && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">Image model</span>
                    <QualityPicker value={imageModel} onChange={setImageModel} />
                  </div>
                  <div className="border-border space-y-0.5 border-t pt-2">
                    <CalcStepper label="Google photos" value={g} min={0} max={10} onChange={setG} />
                    <CalcStepper
                      label="Instagram photos"
                      value={ig}
                      min={0}
                      max={20}
                      onChange={setIg}
                    />
                  </div>
                </>
              )}
            </div>
          </CalcPanel>

          <CalcPanel title="Batch" icon={<Globe className="h-3.5 w-3.5" />}>
            <CalcStepper label="Places" value={places} min={1} max={5000} onChange={setPlaces} />
          </CalcPanel>
        </aside>

        <div className="flex flex-col gap-5">
          <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-6 sm:gap-8">
              <div>
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
                  Cost
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                  {money(perPlace)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">per place</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
                  Time
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                  ~{fmtTime(perPlaceSecs)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">per place</p>
              </div>
            </div>

            {places > 1 && (
              <div className="border-border bg-background mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
                <span className="text-muted-foreground text-sm">
                  Batch total · {places} places
                </span>
                <div className="flex items-center gap-4 text-sm font-semibold tabular-nums">
                  <span>${total.toFixed(2)}</span>
                  <span className="text-muted-foreground font-normal">·</span>
                  <span>~{fmtTime(totalSecs)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Breakdown</h3>
            <div className="flex flex-col gap-3">
              {stages.map((stage) => {
                const stageLines = active.filter((l) => l.stage === stage);
                const meta = STAGE_META[stage];
                const stageCost = stageLines.reduce((s, l) => s + l.cost, 0);
                const stageSecs =
                  stage === "gather"
                    ? stageLines.reduce((mx, l) => Math.max(mx, l.secs), 0)
                    : stageLines.reduce((s, l) => s + l.secs, 0);

                return (
                  <section
                    key={stage}
                    className="border-border bg-card overflow-hidden rounded-2xl border"
                  >
                    <div className="border-border bg-background/60 flex items-start justify-between gap-4 border-b px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{meta.label}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">{meta.hint}</p>
                      </div>
                      <div className="shrink-0 text-right text-sm tabular-nums">
                        <span className="font-medium">{money(stageCost)}</span>
                        <span className="text-muted-foreground mx-1.5">·</span>
                        <span className="text-muted-foreground">~{fmtTime(stageSecs)}</span>
                      </div>
                    </div>
                    <ul className="divide-border/60 divide-y">
                      {stageLines.map((l) => (
                        <li
                          key={l.label}
                          className="flex items-center justify-between gap-4 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm">{l.label}</p>
                            <p className="text-muted-foreground truncate text-xs">{l.detail}</p>
                          </div>
                          <div className="shrink-0 text-right text-sm tabular-nums">
                            <span className="text-muted-foreground">{fmtTime(l.secs)}</span>
                            <span className="mx-2 text-muted-foreground/50">·</span>
                            <span>{money(l.cost)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>

          <p className="text-muted-foreground/80 text-xs leading-relaxed">
            Based on the enricher rate card. Gather steps overlap, so total time is setup +
            slowest gather + analysis — not the sum of every row. Batch time assumes places run
            sequentially. Level 5 heavy scrapes are not yet included.
          </p>
        </div>
      </div>
    </div>
  );
}

export function CostSection({
  standalone = false,
  initialSynthesisQuality,
  initialVisionQuality,
  initialImageVisionEnabled,
  initialAnalyzeGoogleImages,
  initialAnalyzeInstagramImages,
}: {
  standalone?: boolean;
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialImageVisionEnabled: boolean;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
}) {
  const [quality, setQuality] = useState<SynthesisQuality>(initialSynthesisQuality);
  const [imageModel, setImageModel] = useState<SynthesisQuality>(initialVisionQuality);
  const [vision, setVision] = useState(initialImageVisionEnabled);
  const [g, setG] = useState(initialAnalyzeGoogleImages);
  const [ig, setIg] = useState(initialAnalyzeInstagramImages);
  const [places, setPlaces] = useState(1);

  const { lines, active, perPlace, total, perPlaceSecs, totalSecs } =
    computeEnrichmentCost({ quality, imageModel, vision, g, ig, places });

  if (standalone) {
    return (
      <CalculatorView
        quality={quality}
        setQuality={setQuality}
        imageModel={imageModel}
        setImageModel={setImageModel}
        vision={vision}
        setVision={setVision}
        g={g}
        setG={setG}
        ig={ig}
        setIg={setIg}
        places={places}
        setPlaces={setPlaces}
        active={active}
        lines={lines}
        perPlace={perPlace}
        total={total}
        perPlaceSecs={perPlaceSecs}
        totalSecs={totalSecs}
      />
    );
  }

  return (
    <SectionCard
      icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
      title="Cost Calculator"
      subtitle="Rough estimate of cost and runtime to enrich one new place with your current settings."
    >
      {/* Headline: cost + time for the current settings, always visible. */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4" /> Per place
          </span>
          <span className="text-lg font-semibold tabular-nums">{money(perPlace)}</span>
        </div>
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4" /> Per place
          </span>
          <span className="text-lg font-semibold tabular-nums">~{fmtTime(perPlaceSecs)}</span>
        </div>
      </div>

      <Collapsible
        summary={standalone ? "Inputs & breakdown" : "Adjust inputs & view breakdown"}
        defaultOpen={standalone}
      >
      {/* Params */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4 xl:flex-row xl:items-center xl:justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Brain className="text-muted-foreground h-4 w-4" />
            Text model
          </span>
          <QualityPicker value={quality} onChange={setQuality} />
        </div>

        <Card
          className="lg:col-span-2"
          icon={<Eye className="text-muted-foreground h-4 w-4" />}
          title="Image analysis enabled"
          desc="When off, photos save without AI ranking and vision costs drop to zero."
          control={<Switch on={vision} pending={false} onClick={() => setVision(!vision)} label="Toggle vision" />}
        />

        {vision && (
          <>
            <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4 xl:flex-row xl:items-center xl:justify-between lg:col-span-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Eye className="text-muted-foreground h-4 w-4" />
                Image model
              </span>
              <QualityPicker value={imageModel} onChange={setImageModel} />
            </div>
            <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Analyze — Google" value={g} min={0} max={10} onChange={setG} disabled={false} />
            <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Analyze — Instagram" value={ig} min={0} max={20} onChange={setIg} disabled={false} />
          </>
        )}

        <NumberField icon={<Layers className="text-muted-foreground h-4 w-4" />} label="Number of places" value={places} min={1} max={5000} onChange={setPlaces} disabled={false} />
      </div>

      {/* Breakdown */}
      <div className="border-border -mx-4 mt-6 overflow-x-auto rounded-xl border sm:mx-0">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left font-medium">Source / step</th>
              <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Detail</th>
              <th className="px-4 py-2.5 text-right font-medium">~Time</th>
              <th className="px-4 py-2.5 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr
                key={l.label}
                className={`border-border/60 border-b last:border-0 ${l.active ? "" : "opacity-40"}`}
              >
                <td className="px-4 py-2.5 font-medium">{l.label}</td>
                <td className="text-muted-foreground hidden px-4 py-2.5 sm:table-cell">{l.detail}</td>
                <td className="text-muted-foreground px-4 py-2.5 text-right tabular-nums">
                  {l.active ? fmtTime(l.secs) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {l.active ? money(l.cost) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-background border-border border-t-2">
              <td className="px-4 py-3 font-semibold" colSpan={2}>
                Per place
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                ~{fmtTime(perPlaceSecs)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {money(perPlace)}
              </td>
            </tr>
            {places > 1 && (
              <tr className="bg-background border-border/60 border-t">
                <td className="text-muted-foreground px-4 py-2.5" colSpan={2}>
                  × {places} places
                </td>
                <td className="text-muted-foreground px-4 py-2.5 text-right font-semibold tabular-nums">
                  ~{fmtTime(totalSecs)}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  ${total.toFixed(2)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <p className="text-muted-foreground/80 mt-3 text-[11px] leading-relaxed">
        Approximate per-step costs based on the enricher&apos;s rate card. Every
        step S1→S9 runs on every enrichment; gather steps run in parallel, so
        total time is pre-work + slowest gather step + post-work — not the sum
        of every row. Batch time assumes places run one after another.
      </p>
      </Collapsible>
    </SectionCard>
  );
}
