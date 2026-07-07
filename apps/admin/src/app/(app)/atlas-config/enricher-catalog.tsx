"use client";

import {
  Brain,
  Database,
  FileText,
  Globe,
  Link2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Collapsible, SectionCard } from "./atlas-ui";

// Enricher node catalog — a faithful mirror of the "🍪 Enricher" Notion DB
// (data source 36fa9bf3…, "N8N Enricher" process rows). Each row is a NODE:
//   • Step (S0–S9) — the canonical pipeline step (shown as the S-badge).
//     EVERY step runs on EVERY enrichment — the old L0–L5 "source level"
//     depth dial is retired; there is no per-run step selection.
//   • Pipeline — Link · Contents · Analysis · Cognition · Persist · Config.
//   • Methods — providers from Notion's "Sources & Methods". For Link nodes
//     the order is the seed→fallback chain: Mesita Input → Google Places →
//     Firecrawl Search & Perplexity Agent (PS3). TikTok/TripAdvisor/Yelp are
//     resolve-only (never actively discovered).
// Read-only — runs are tuned with the image/vision/model knobs below, not by
// toggling nodes.
export type Pipeline = "Link" | "Contents" | "Analysis" | "Cognition" | "Persist" | "Config";

// Notion "Sources & Methods" multi-select options (verbatim).
export type Method =
  | "Google Places"
  | "Google Timezone"
  | "Apify"
  | "Mesita Input"
  | "OpenAI LLM"
  | "OpenAI Vision"
  | "Firecrawl Scrape"
  | "Firecrawl Search and Perplexity Agent Y"
  | "Perplexity Agent X"
  | "Supabase";

export type Step = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8" | "S9";

type AdeaNode = {
  name: string;
  pipeline: Pipeline;
  step: Step;
  methods: Method[];
};

const FC_PPLX_AGENT: Method[] = [
  "Mesita Input",
  "Google Places",
  "Firecrawl Search and Perplexity Agent Y",
];

const RESOLVE_ONLY: Method[] = ["Mesita Input", "Google Places"];

const ADEA_NODES: AdeaNode[] = [
  // S0 · run config + identity seed
  { name: "Atlas and Enricher Configuration", pipeline: "Config", step: "S0", methods: ["Supabase"] },
  { name: "Cognition Engine", pipeline: "Cognition", step: "S0", methods: ["OpenAI LLM", "OpenAI Vision"] },
  { name: "Google Business Page Link", pipeline: "Link", step: "S0", methods: ["Mesita Input"] },
  { name: "Mesita Page Link", pipeline: "Link", step: "S0", methods: ["Mesita Input"] },
  // S1 · Google spine — HARD GATE: if the profile fails the run aborts
  { name: "Google Business Page Profile", pipeline: "Contents", step: "S1", methods: ["Google Places"] },
  { name: "Google Business Page Timezone", pipeline: "Contents", step: "S1", methods: ["Google Timezone"] },
  // S2 · web-grounded editorial read (soft context)
  { name: "SERP Page AI Summary", pipeline: "Analysis", step: "S2", methods: ["Perplexity Agent X"] },
  // S3 · channel links + contacts (active discovery vs resolve-only)
  { name: "Website Page Link", pipeline: "Link", step: "S3", methods: FC_PPLX_AGENT },
  { name: "Instagram Page Link", pipeline: "Link", step: "S3", methods: FC_PPLX_AGENT },
  { name: "Facebook Page Link", pipeline: "Link", step: "S3", methods: FC_PPLX_AGENT },
  { name: "OpenTable Page Link", pipeline: "Link", step: "S3", methods: FC_PPLX_AGENT },
  { name: "UberEats Page Link", pipeline: "Link", step: "S3", methods: FC_PPLX_AGENT },
  { name: "TikTok Page Link", pipeline: "Link", step: "S3", methods: RESOLVE_ONLY },
  { name: "TripAdvisor Page Link", pipeline: "Link", step: "S3", methods: RESOLVE_ONLY },
  { name: "Yelp Page Link", pipeline: "Link", step: "S3", methods: RESOLVE_ONLY },
  { name: "Phone Number", pipeline: "Link", step: "S3", methods: FC_PPLX_AGENT },
  { name: "Email Address", pipeline: "Link", step: "S3", methods: FC_PPLX_AGENT },
  // S4 · source harvest — parallel scrapers
  { name: "Google Business Page Photos", pipeline: "Contents", step: "S4", methods: ["Google Places"] },
  { name: "Google Business Page Reviews", pipeline: "Contents", step: "S4", methods: ["Apify"] },
  { name: "Instagram Page Profile", pipeline: "Contents", step: "S4", methods: ["Apify"] },
  { name: "Instagram Page Photos", pipeline: "Contents", step: "S4", methods: ["Apify"] },
  { name: "Facebook Page Profile", pipeline: "Contents", step: "S4", methods: ["Apify"] },
  // S5 · image perception (one vision call per analyzed image)
  { name: "Images Descriptions", pipeline: "Analysis", step: "S5", methods: ["OpenAI Vision"] },
  // S6 · image ranking + final selection
  { name: "Images Ranking and Sorting", pipeline: "Analysis", step: "S6", methods: ["OpenAI LLM"] },
  // S7 · synthesis — About, category, tags (closed vocab from S0 config)
  { name: "Place About", pipeline: "Analysis", step: "S7", methods: ["OpenAI LLM"] },
  { name: "Place Category", pipeline: "Analysis", step: "S7", methods: ["OpenAI LLM"] },
  { name: "Place Tags", pipeline: "Analysis", step: "S7", methods: ["OpenAI LLM"] },
  // S8/S9 · persist — Edge Functions only (n8n never touches the DB)
  { name: "Save Data in Supabase DB", pipeline: "Persist", step: "S8", methods: ["Supabase"] },
  { name: "Save Images in Supabase Storage", pipeline: "Persist", step: "S9", methods: ["Supabase"] },
];

// Per-method chip tint, keyed to the provider family (spine, Google,
// Firecrawl, Apify, OpenAI, Meta). The chip shows the method's full spec name —
// no abbreviations. Light-themed admin surface, subtle tints only.
const METHOD_CLS: Record<Method, string> = {
  "Mesita Input": "border-foreground/20 bg-foreground/5 text-foreground/80",
  "Google Places": "border-red-500/25 bg-red-500/10 text-red-600",
  "Google Timezone": "border-red-500/25 bg-red-500/10 text-red-600",
  "Apify": "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  "Firecrawl Scrape": "border-amber-500/25 bg-amber-500/10 text-amber-700",
  "Firecrawl Search and Perplexity Agent Y":
    "border-orange-500/25 bg-orange-500/10 text-orange-700",
  "Perplexity Agent X": "border-purple-500/25 bg-purple-500/10 text-purple-600",
  "OpenAI LLM": "border-sky-500/25 bg-sky-500/10 text-sky-700",
  "OpenAI Vision": "border-violet-500/25 bg-violet-500/10 text-violet-600",
  "Supabase": "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
};

// Every enrichment run executes ALL steps S0→S9 in order — there is no depth
// dial. Tuning is done via the image / vision / model knobs below, not by
// turning steps on and off. This card is a read-only map of what always runs.
const STEP_GROUPS: { step: Step; blurb: string }[] = [
  { step: "S0", blurb: "Config + identity seed — run knobs, vocab, Google & Mesita links" },
  { step: "S1", blurb: "Google profile + timezone — the identity spine (hard gate)" },
  { step: "S2", blurb: "SERP editorial summary — web-grounded soft context" },
  { step: "S3", blurb: "Channel links & contacts — website, socials, delivery, phone, email" },
  { step: "S4", blurb: "Source harvest — Google photos/reviews, Instagram, Facebook" },
  { step: "S5", blurb: "Image descriptions — one vision call per analyzed photo" },
  { step: "S6", blurb: "Image ranking — sort & select the final gallery" },
  { step: "S7", blurb: "Synthesis — About, category & tags from the closed vocab" },
  { step: "S8", blurb: "Persist profile — write place data (flips status to ready)" },
  { step: "S9", blurb: "Persist images — mirror the selected gallery to Storage" },
];

// ─── Pipeline steps (read-only) ────────────────────────────────────────────

export function StepsOverviewSection() {
  return (
    <SectionCard
      icon={<Globe className="text-muted-foreground h-4 w-4" />}
      title="Pipeline steps"
      subtitle="Every run executes all steps S0→S6 in order. There are no tiers or depth levels — tune the run with the image, vision and model settings below."
    >
      <Collapsible summary="What runs on every enrichment" defaultOpen={false}>
        <div className="flex flex-col gap-5">
          {STEP_GROUPS.map(({ step, blurb }) => {
            const nodes = ADEA_NODES.filter((n) => n.step === step);
            if (nodes.length === 0) return null;
            return (
              <div key={step}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StepBadge step={step} />
                  <span className="text-sm font-medium">{blurb}</span>
                  <span className="text-muted-foreground text-[11px]">· always runs</span>
                </div>
                <div className="flex flex-col gap-2">
                  {nodes.map((n) => (
                    <NodeRow key={n.name} node={n} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Collapsible>
    </SectionCard>
  );
}

// One ADEA node: its step + pipeline badges + name on the left, method chips on
// the right. For Link nodes the methods read left→right as seed→fallback order.
function NodeRow({ node }: { node: AdeaNode }) {
  return (
    <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
      <span className="flex items-center gap-2 text-sm font-medium">
        <StepBadge step={node.step} />
        <PipelineBadge pipeline={node.pipeline} />
        {node.name}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {node.methods.map((m) => (
          <MethodChip key={m} method={m} />
        ))}
      </div>
    </div>
  );
}

function StepBadge({ step }: { step: Step }) {
  return (
    <span className="border-border bg-card text-muted-foreground inline-flex h-5 min-w-[28px] items-center justify-center rounded border px-1 text-[10px] font-semibold tabular-nums">
      {step}
    </span>
  );
}

function PipelineBadge({ pipeline }: { pipeline: Pipeline }) {
  const meta = {
    Link: { Icon: Link2, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
    Contents: { Icon: FileText, cls: "border-rose-500/30 bg-rose-500/10 text-rose-600" },
    Analysis: { Icon: Sparkles, cls: "border-sky-500/30 bg-sky-500/10 text-sky-700" },
    Cognition: { Icon: Brain, cls: "border-purple-500/30 bg-purple-500/10 text-purple-700" },
    Persist: { Icon: Database, cls: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
    Config: { Icon: SlidersHorizontal, cls: "border-foreground/20 bg-foreground/5 text-foreground/70" },
  }[pipeline];
  const { Icon, cls } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {pipeline}
    </span>
  );
}

function MethodChip({ method }: { method: Method }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${METHOD_CLS[method]}`}
    >
      {method}
    </span>
  );
}

const PIPELINE: { stage: Pipeline; blurb: string }[] = [
  { stage: "Link", blurb: "find source URLs" },
  { stage: "Contents", blurb: "download data from each source" },
  { stage: "Analysis", blurb: "analyze photos & text, write profile" },
];

// Compact visual of the ADEA pipeline — every node is one of these three
// stages (see the Sources card). Link resolves URLs, Contents fetches from
// them, and Analysis (Text + Image perception → Cognition) writes the profile.
export function PipelineStrip() {
  return (
    <div className="border-border bg-card rounded-2xl border p-4 sm:p-5">
      <p className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-[0.14em] uppercase">
        How the Enricher works
      </p>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PIPELINE.map(({ stage, blurb }, i) => (
          <li
            key={stage}
            className="border-border bg-background flex gap-3 rounded-xl border p-3"
          >
            <span className="bg-foreground text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{stage}</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                {blurb}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
