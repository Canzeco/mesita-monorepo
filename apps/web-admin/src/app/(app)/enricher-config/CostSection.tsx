"use client";

import { useState } from "react";
import { Brain, Images, Layers, Link2 } from "lucide-react";
import type { SynthesisQuality } from "./actions";
import { QualityPicker } from "./atlas-ui";
import {
  computeEnrichmentCost,
  fmtTime,
  LINK_CHANNELS,
  money,
  type LinkChannel,
  type LinkCounts,
} from "./cost-model";

// ─── Enricher Calculator — cost & runtime estimator ─────────────────────────
// A what-if estimator that mirrors the three Enricher Params boxes (Models ·
// Images · Links) and prices one enrichment against each provider's published
// rate card. Image analysis is always on; Selection and Storage don't change
// cost, so they're not inputs here. The breakdown keeps the Fields · Notes ·
// Pricing columns so the table doubles as living cost documentation.

const LINK_LABELS: Record<LinkChannel, string> = {
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  opentable: "OpenTable",
  ubereats: "Uber Eats",
};

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
      <h3 className="text-muted-foreground mb-3 flex items-center gap-2 type-label font-semibold tracking-[0.12em] uppercase">
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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={value <= min}
          onClick={dec}
          aria-label={`Decrease ${label}`}
          className="border-border bg-background hover:border-foreground/40 flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition disabled:opacity-40"
        >
          −
        </button>
        <span className="w-9 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          disabled={value >= max}
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

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground type-label font-semibold tracking-wide uppercase">
      {children}
    </p>
  );
}

export function CostSection({
  initialSynthesisQuality,
  initialVisionQuality,
  initialGatherGoogleImages,
  initialGatherInstagramDepth,
  initialAnalyzeGoogleImages,
  initialAnalyzeInstagramImages,
  initialLinks,
}: {
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialGatherGoogleImages: number;
  initialGatherInstagramDepth: number;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
  initialLinks: LinkCounts;
}) {
  const [quality, setQuality] = useState<SynthesisQuality>(initialSynthesisQuality);
  const [imageModel, setImageModel] = useState<SynthesisQuality>(initialVisionQuality);
  const [gCollect, setGCollect] = useState(initialGatherGoogleImages);
  const [igCollect, setIgCollect] = useState(initialGatherInstagramDepth);
  const [gAnalyze, setGAnalyze] = useState(
    Math.min(initialAnalyzeGoogleImages, initialGatherGoogleImages),
  );
  const [igAnalyze, setIgAnalyze] = useState(
    Math.min(initialAnalyzeInstagramImages, initialGatherInstagramDepth),
  );
  const [links, setLinks] = useState<LinkCounts>(initialLinks);
  const [places, setPlaces] = useState(1);

  // Collection caps Analysis — clamp the analyze count when a collect knob drops.
  const changeGCollect = (v: number) => {
    setGCollect(v);
    setGAnalyze((a) => Math.min(a, v));
  };
  const changeIgCollect = (v: number) => {
    setIgCollect(v);
    setIgAnalyze((a) => Math.min(a, v));
  };
  const setLink = (c: LinkChannel, v: number) =>
    setLinks((cur) => ({ ...cur, [c]: v }));

  const { lines, perPlace, total, perPlaceSecs, totalSecs } = computeEnrichmentCost({
    quality,
    imageModel,
    gCollect,
    igCollect,
    gAnalyze,
    igAnalyze,
    links,
    places,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
        Estimate cost and runtime to enrich one new place with the current
        Enricher config. Every function runs on a full enrichment and image
        analysis is always on — Selection and Storage don&apos;t change cost, so
        they&apos;re not inputs here. Rows are numbered by the function that
        spends them, so several can share a number. Figures are approximate,
        not billing.
      </p>

      {/* Headline result — cost + time, always visible above the inputs */}
      <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-6 sm:gap-8">
          <div>
            <p className="text-muted-foreground type-label font-semibold tracking-[0.12em] uppercase">
              Cost
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
              {money(perPlace)}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">per place</p>
          </div>
          <div>
            <p className="text-muted-foreground type-label font-semibold tracking-[0.12em] uppercase">
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

      {/* Inputs — a balanced 2-col grid, never a cramped sidebar */}
      <div className="grid gap-4 md:grid-cols-2">
        <CalcPanel title="Models" icon={<Brain className="h-3.5 w-3.5" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Profile text</span>
              <QualityPicker value={quality} onChange={setQuality} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Image vision</span>
              <QualityPicker value={imageModel} onChange={setImageModel} />
            </div>
          </div>
        </CalcPanel>

        <CalcPanel title="Batch" icon={<Layers className="h-3.5 w-3.5" />}>
          <CalcStepper label="Places" value={places} min={1} max={5000} onChange={setPlaces} />
        </CalcPanel>

        <CalcPanel title="Images" icon={<Images className="h-3.5 w-3.5" />}>
          <div className="flex flex-col gap-1">
            <SubLabel>Collection</SubLabel>
            <CalcStepper label="Google collect" value={gCollect} min={1} max={10} onChange={changeGCollect} />
            <CalcStepper label="Instagram collect" value={igCollect} min={1} max={50} onChange={changeIgCollect} />
            <div className="border-border mt-2 border-t pt-2">
              <SubLabel>Analysis</SubLabel>
            </div>
            <CalcStepper label="Analyze Google" value={gAnalyze} min={0} max={gCollect} onChange={setGAnalyze} />
            <CalcStepper label="Analyze Instagram" value={igAnalyze} min={0} max={igCollect} onChange={setIgAnalyze} />
          </div>
        </CalcPanel>

        <CalcPanel title="Links" icon={<Link2 className="h-3.5 w-3.5" />}>
          <div className="flex flex-col gap-0.5">
            {LINK_CHANNELS.map((c) => (
              <CalcStepper
                key={c}
                label={LINK_LABELS[c]}
                value={links[c]}
                min={0}
                max={10}
                onChange={(v) => setLink(c, v)}
              />
            ))}
          </div>
        </CalcPanel>
      </div>

      {/* Breakdown — full width so the 6-column table has room (Fields · Notes · Pricing) */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Breakdown</h3>
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-border text-muted-foreground border-b type-eyebrow">
                    <th className="px-4 py-2.5 text-left font-medium">Source / step</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Fields</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">Notes</th>
                    <th className="px-4 py-2.5 text-right font-medium">Pricing</th>
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
                      <td className="px-4 py-2.5 align-top font-medium">
                        {l.label}
                        {/* Fields + Notes fold under the label on narrow viewports */}
                        <span className="text-muted-foreground mt-0.5 block text-xs font-normal sm:hidden">
                          {l.detail} · {l.note}
                        </span>
                      </td>
                      <td className="text-muted-foreground hidden px-4 py-2.5 align-top sm:table-cell">
                        {l.detail}
                      </td>
                      <td className="text-muted-foreground hidden max-w-[280px] px-4 py-2.5 align-top text-xs md:table-cell">
                        {l.note}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-right align-top text-xs tabular-nums whitespace-nowrap">
                        {l.pricing}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-right align-top tabular-nums">
                        {l.active ? fmtTime(l.secs) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right align-top tabular-nums">
                        {l.active ? money(l.cost) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-background border-border border-t-2">
                    <td className="px-4 py-3 font-semibold" colSpan={4}>
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
                      <td className="text-muted-foreground px-4 py-2.5" colSpan={4}>
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
          </div>

          <p className="text-muted-foreground/80 text-xs leading-relaxed">
            Per-step costs from each provider&apos;s published rate card (Google
            Places, Apify, Firecrawl, Perplexity, OpenAI — verified 2026-07-07).
            Collection scales the Google-photo and Instagram-post volumes, Links
            sets how many channels are searched, and Analysis drives the vision
            calls. The Apify scrapes run concurrently and image analysis is fully
            parallel, so total time is setup + slowest gather + ~one analysis
            round — not the sum of every row. Batch time assumes places run
            sequentially.
          </p>
    </div>
  );
}
