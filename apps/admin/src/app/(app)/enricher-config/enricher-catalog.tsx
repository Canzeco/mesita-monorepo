"use client";

import {
  Brain,
  Database,
  Download,
  FileText,
  Link2,
  Search,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
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
//     Firecrawl Search & Perplexity Agent (PS3). Yelp is
//     resolve-only (never actively discovered). TikTok retired 2026-07-11.
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
  // S7 · sequential: About first, then category + tags grounded on that About
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
  { step: "S7", blurb: "Synthesis — About first, then category & tags grounded on that About" },
  { step: "S8", blurb: "Persist profile — write place data (flips status to ready)" },
  { step: "S9", blurb: "Persist images — mirror the selected gallery to Storage" },
];

// ─── Pipeline (read-only) — three phase boxes ──────────────────────────────
// The S0→S9 catalog above, regrouped into the three phases every run moves
// through in order:
//   ① Research  (S0–S3) — pin down the place & discover its sources
//   ② Harvest   (S4)    — pull each confirmed source's raw data
//   ③ Synthesis (S5–S9) — analyze, write & persist the finished profile
// Still no depth dial: every step runs on every enrichment. Tuning happens via
// the image / vision / model knobs below, never by toggling steps.

const PHASES: {
  name: string;
  Icon: LucideIcon;
  steps: Step[];
  range: string;
  blurb: string;
}[] = [
  {
    name: "Research",
    Icon: Search,
    steps: ["S0", "S1", "S2", "S3"],
    range: "S0–S3",
    blurb:
      "Pin down the place and find its sources — seed the run config & identity links, lock the Google profile spine (hard gate: no profile, no run), read a web SERP summary, then discover channel links & contacts.",
  },
  {
    name: "Harvest",
    Icon: Download,
    steps: ["S4"],
    range: "S4",
    blurb:
      "Pull the raw material from every confirmed source in parallel — Google photos & reviews, Instagram profile & photos, Facebook profile.",
  },
  {
    name: "Synthesis",
    Icon: Sparkles,
    steps: ["S5", "S6", "S7", "S8", "S9"],
    range: "S5–S9",
    blurb:
      "Turn the harvest into the finished profile — describe & rank the analyzed images, write the About, then infer category & tags from that About (closed vocab), then persist the place to the DB and mirror its gallery to Storage.",
  },
];

// Three stacked boxes, one per phase. Each shows its step blurbs inline and
// tucks the full node × method breakdown behind a per-box disclosure.
export function StepsOverviewSection() {
  return (
    <>
      {PHASES.map((phase, i) => (
        <PhaseCard key={phase.name} phase={phase} index={i} />
      ))}
    </>
  );
}

function PhaseCard({
  phase,
  index,
}: {
  phase: (typeof PHASES)[number];
  index: number;
}) {
  const { name, Icon, steps, range, blurb } = phase;
  const groups = STEP_GROUPS.filter((g) => steps.includes(g.step));
  const nodes = ADEA_NODES.filter((n) => steps.includes(n.step));
  return (
    <SectionCard
      icon={<Icon className="text-muted-foreground h-4 w-4" />}
      title={`${index + 1} · ${name}`}
      subtitle={blurb}
      status={
        <span className="border-border bg-background inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums">
          <span className="text-muted-foreground font-medium">steps</span>
          {range}
        </span>
      }
    >
      <div className="mt-5 flex flex-col gap-2.5">
        {groups.map((g) => (
          <div key={g.step} className="flex items-start gap-2">
            <StepBadge step={g.step} />
            <span className="text-sm leading-relaxed">{g.blurb}</span>
          </div>
        ))}
      </div>
      <Collapsible summary="Nodes & methods">
        <div className="flex flex-col gap-2">
          {nodes.map((n) => (
            <NodeRow key={n.name} node={n} />
          ))}
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

const PIPELINE: { stage: string; blurb: string }[] = [
  { stage: "Research", blurb: "pin down the place & find its source links" },
  { stage: "Harvest", blurb: "download the data from each confirmed source" },
  { stage: "Synthesis", blurb: "analyze photos & text, write & persist the profile" },
];

// Compact visual of the enrichment pipeline — the same three phases the boxes
// below expand: Research pins down the place and resolves its sources, Harvest
// pulls each source's raw data, and Synthesis analyzes it all and writes the
// finished profile.
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
