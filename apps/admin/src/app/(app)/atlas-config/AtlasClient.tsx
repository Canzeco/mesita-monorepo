"use client";

import { Fragment, useState, useTransition } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  Instagram,
  Layers,
  Link2,
  Loader2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { updateAtlasConfig, type SynthesisQuality } from "./actions";

// ADEA node catalog — a 1:1 mirror of the reformatted "🌐 ADEA" Notion DB.
// Each row is a NODE in the enrichment pipeline, classified three ways:
//   • Pipeline — Link (resolve a source's URL) → Contents (fetch from it) →
//     Analysis (perceive + reason over everything gathered).
//   • Tier (T0–T5) — the gate. The admin's tier ceiling runs every node whose
//     tier ≤ ceiling. T0 is the always-on spine + cognition (never gated).
//   • Methods — the concrete providers. For Link nodes the list is the
//     FALLBACK order (stop at the first confident hit); for Contents/Analysis
//     it's the tool(s) the node runs.
// These chips are READ-ONLY indicators — selection is driven by the tier
// ceiling, not by editing chips. When the enrich agent fully consumes this, it
// must mirror the same catalog server-side. Keep in sync with the ADEA DB.
type Pipeline = "Link" | "Contents" | "Analysis";

type Method =
  | "Mesita Input"
  | "Google Places"
  | "Firecrawl Search"
  | "Firecrawl Crawl"
  | "Firecrawl Scrape"
  | "Perplexity"
  | "Apify"
  | "OpenAI LLM"
  | "OpenAI Vision"
  | "Meta Graph API";

type Tier = 0 | 1 | 2 | 3 | 4 | 5;

type AdeaNode = {
  name: string;
  pipeline: Pipeline;
  tier: Tier;
  methods: Method[];
};

const ADEA_NODES: AdeaNode[] = [
  // T0 — spine + cognition (always on, never gated)
  { name: "Google Business Page Link", pipeline: "Link", tier: 0, methods: ["Mesita Input"] },
  { name: "Mesita Page Link", pipeline: "Link", tier: 0, methods: ["Mesita Input"] },
  { name: "Text Assets Processing", pipeline: "Analysis", tier: 0, methods: ["OpenAI LLM"] },
  { name: "Image Assets Processing", pipeline: "Analysis", tier: 0, methods: ["OpenAI Vision"] },
  { name: "Cognition Engine", pipeline: "Analysis", tier: 0, methods: ["OpenAI LLM"] },
  // T1 — Google business contents + web-grounded editorial
  { name: "Google Business Page Profile", pipeline: "Contents", tier: 1, methods: ["Google Places"] },
  { name: "Google Business Page Photos", pipeline: "Contents", tier: 1, methods: ["Google Places"] },
  { name: "Google Business Page Reviews", pipeline: "Contents", tier: 1, methods: ["Apify"] },
  { name: "SERP Page AI Summary", pipeline: "Contents", tier: 1, methods: ["Perplexity"] },
  // T2 — owner social & website
  { name: "Website Page Link", pipeline: "Link", tier: 2, methods: ["Mesita Input", "Google Places", "Firecrawl Search", "Perplexity"] },
  { name: "Website Page Contents", pipeline: "Contents", tier: 2, methods: ["Firecrawl Crawl"] },
  { name: "Instagram Page Link", pipeline: "Link", tier: 2, methods: ["Mesita Input", "Google Places", "Firecrawl Search", "Perplexity"] },
  { name: "Instagram Page Profile", pipeline: "Contents", tier: 2, methods: ["Meta Graph API", "Apify"] },
  { name: "Instagram Page Photos", pipeline: "Contents", tier: 2, methods: ["Apify"] },
  { name: "Facebook Page Link", pipeline: "Link", tier: 2, methods: ["Mesita Input", "Google Places", "Firecrawl Search", "Perplexity"] },
  { name: "Facebook Page Profile", pipeline: "Contents", tier: 2, methods: ["Apify"] },
  // T3 — reservations & delivery links
  { name: "OpenTable Page Link", pipeline: "Link", tier: 3, methods: ["Mesita Input", "Google Places", "Firecrawl Search"] },
  { name: "UberEats Page Link", pipeline: "Link", tier: 3, methods: ["Mesita Input", "Google Places", "Firecrawl Search"] },
  // T4 — niche social links
  { name: "TripAdvisor Page Link", pipeline: "Link", tier: 4, methods: ["Mesita Input", "Google Places", "Firecrawl Search"] },
  { name: "Yelp Page Link", pipeline: "Link", tier: 4, methods: ["Mesita Input", "Google Places", "Firecrawl Search"] },
  { name: "TikTok Page Link", pipeline: "Link", tier: 4, methods: ["Mesita Input", "Google Places", "Firecrawl Search"] },
  { name: "YouTube Page Link", pipeline: "Link", tier: 4, methods: ["Mesita Input", "Google Places", "Firecrawl Search"] },
  // T5 — heavy third-party contents (gated on purpose)
  { name: "OpenTable Page Contents", pipeline: "Contents", tier: 5, methods: ["Apify"] },
  { name: "TripAdvisor Page Contents", pipeline: "Contents", tier: 5, methods: ["Apify"] },
  { name: "SERP Page Contents", pipeline: "Contents", tier: 5, methods: ["Firecrawl Search", "Firecrawl Scrape"] },
];

// Tier metadata — the ceiling spans T1–T5; T0 is always on. The one-line
// blurbs mirror the ADEA spec's tier intent.
const TIERS: { tier: Tier; blurb: string; alwaysOn?: boolean }[] = [
  { tier: 0, blurb: "Spine & cognition", alwaysOn: true },
  { tier: 1, blurb: "Google business contents + editorial" },
  { tier: 2, blurb: "Owner social & website" },
  { tier: 3, blurb: "Reservations & delivery links" },
  { tier: 4, blurb: "Niche social links" },
  { tier: 5, blurb: "Heavy third-party contents" },
];

const CEILING_MIN = 1;
const CEILING_MAX = 5;

// Per-method chip styling. Short label + a tinted class keyed to the provider
// family so the spine (Mesita), Google, Firecrawl, Apify, OpenAI and Meta read
// at a glance. Light-themed admin surface — subtle tints only.
const METHOD_META: Record<Method, { short: string; cls: string }> = {
  "Mesita Input": { short: "Mesita", cls: "border-foreground/20 bg-foreground/5 text-foreground/80" },
  "Google Places": { short: "Places", cls: "border-red-500/25 bg-red-500/10 text-red-600" },
  "Firecrawl Search": { short: "FC Search", cls: "border-amber-500/25 bg-amber-500/10 text-amber-700" },
  "Firecrawl Crawl": { short: "FC Crawl", cls: "border-amber-500/25 bg-amber-500/10 text-amber-700" },
  "Firecrawl Scrape": { short: "FC Scrape", cls: "border-amber-500/25 bg-amber-500/10 text-amber-700" },
  "Perplexity": { short: "Perplexity", cls: "border-purple-500/25 bg-purple-500/10 text-purple-600" },
  "Apify": { short: "Apify", cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" },
  "OpenAI LLM": { short: "OpenAI", cls: "border-sky-500/25 bg-sky-500/10 text-sky-700" },
  "OpenAI Vision": { short: "Vision", cls: "border-violet-500/25 bg-violet-500/10 text-violet-600" },
  "Meta Graph API": { short: "Graph API", cls: "border-blue-500/25 bg-blue-500/10 text-blue-600" },
};

export function AtlasClient(props: {
  initialSourceTierCeiling: number;
  initialSourceOverrides: Record<string, boolean>;
  initialWebsiteCrawlMaxPages: number;
  initialGatherGoogleImages: number;
  initialGatherWebsiteImages: number;
  initialGatherInstagramPosts: number;
  initialImageVisionEnabled: boolean;
  initialSaveTotalImages: number;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeWebsiteImages: number;
  initialAnalyzeInstagramImages: number;
  initialImageAnalysisPrompt: string;
  initialImageSortingPrompt: string;
  initialSynthesisQuality: SynthesisQuality;
  initialPerRunCostCapUsd: number;
  initialUpdatedAt: string | null;
}) {
  const [updatedAt, setUpdatedAt] = useState(props.initialUpdatedAt);

  return (
    <div className="mt-8 flex flex-col gap-6">
      {updatedAt && (
        <p className="text-muted-foreground text-[11px]">
          Settings last changed{" "}
          {new Date(updatedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

      <PipelineStrip />

      <SourcesSection
        initialTierCeiling={props.initialSourceTierCeiling}
        onSaved={setUpdatedAt}
      />
      <SourceDepthSection
        initialWebsiteCrawlMaxPages={props.initialWebsiteCrawlMaxPages}
        onSaved={setUpdatedAt}
      />
      <GatherSection
        initialGatherGoogleImages={props.initialGatherGoogleImages}
        initialGatherWebsiteImages={props.initialGatherWebsiteImages}
        initialGatherInstagramPosts={props.initialGatherInstagramPosts}
        onSaved={setUpdatedAt}
      />
      <VisionParamsSection
        initialImageVisionEnabled={props.initialImageVisionEnabled}
        initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
        initialAnalyzeWebsiteImages={props.initialAnalyzeWebsiteImages}
        initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
        initialSaveTotalImages={props.initialSaveTotalImages}
        initialImageAnalysisPrompt={props.initialImageAnalysisPrompt}
        initialImageSortingPrompt={props.initialImageSortingPrompt}
        onSaved={setUpdatedAt}
      />
      <SynthCostSection
        initialSynthesisQuality={props.initialSynthesisQuality}
        initialPerRunCostCapUsd={props.initialPerRunCostCapUsd}
        onSaved={setUpdatedAt}
      />
      <CostSection
        initialSourceTierCeiling={props.initialSourceTierCeiling}
        initialSynthesisQuality={props.initialSynthesisQuality}
        initialImageVisionEnabled={props.initialImageVisionEnabled}
        initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
        initialAnalyzeWebsiteImages={props.initialAnalyzeWebsiteImages}
        initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
      />
    </div>
  );
}

// ─── Sourcing ────────────────────────────────────────────────────────────

function SourcesSection({
  initialTierCeiling,
  onSaved,
}: {
  initialTierCeiling: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [ceiling, setCeiling] = useState(initialTierCeiling);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const changeCeiling = (next: number) => {
    const prev = ceiling;
    setCeiling(next);
    setError(null);
    start(async () => {
      const r = await updateAtlasConfig({ sourceTierCeiling: next });
      if (!r.ok) {
        setCeiling(prev);
        setError(r.error);
        return;
      }
      setCeiling(r.data.atlasSourceTierCeiling);
      onSaved(r.data.updatedAt);
    });
  };

  return (
    <SectionCard
      icon={<Globe className="text-muted-foreground h-4 w-4" />}
      title="Sources"
      subtitle="The tier ceiling runs every ADEA node whose tier is at or below it. T0 — the Google/Mesita spine plus the analysis brain — is always on. The grouped nodes below mirror the ADEA spec; they're read-only."
      status={pending ? <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" /> : null}
    >
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Tier ceiling</label>
        <div className="flex items-center gap-1.5">
          <Layers className="text-muted-foreground h-4 w-4" />
          <span
            title="Always on — the spine and cognition layer can't be turned off"
            className="border-foreground/30 bg-foreground/5 text-muted-foreground flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold"
          >
            T0 <span className="opacity-70">· always</span>
          </span>
          {Array.from({ length: CEILING_MAX - CEILING_MIN + 1 }, (_, i) => CEILING_MIN + i).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeCeiling(t)}
              disabled={pending}
              aria-pressed={ceiling === t}
              className={`h-9 w-11 rounded-lg border text-sm font-semibold tabular-nums transition disabled:opacity-50 ${
                ceiling === t
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:border-foreground/40"
              }`}
            >
              T{t}
            </button>
          ))}
        </div>
      </div>

      <Collapsible summary={`Nodes active at tier ${ceiling}`}>
        <div className="flex flex-col gap-5">
          {TIERS.map(({ tier, blurb, alwaysOn }) => {
            const tierActive = alwaysOn || tier <= ceiling;
            const nodes = ADEA_NODES.filter((n) => n.tier === tier);
            return (
              <div key={tier} className={tierActive ? "" : "opacity-50"}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <TierBadge tier={tier} on={tierActive} />
                  <span className="text-sm font-medium">{blurb}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {alwaysOn
                      ? "· always on"
                      : tierActive
                        ? "· active"
                        : "· above ceiling"}
                  </span>
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

      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

// One ADEA node: its pipeline badge + name on the left, its method chips on the
// right. For Link nodes the methods read left→right as fallback order.
function NodeRow({ node }: { node: AdeaNode }) {
  return (
    <div className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      <span className="flex items-center gap-2 text-sm font-medium">
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

function PipelineBadge({ pipeline }: { pipeline: Pipeline }) {
  const meta = {
    Link: { Icon: Link2, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
    Contents: { Icon: FileText, cls: "border-rose-500/30 bg-rose-500/10 text-rose-600" },
    Analysis: { Icon: Brain, cls: "border-sky-500/30 bg-sky-500/10 text-sky-700" },
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

function TierBadge({ tier, on }: { tier: Tier; on: boolean }) {
  return (
    <span
      className={`inline-flex h-6 min-w-9 items-center justify-center rounded-md border px-1.5 text-xs font-semibold tabular-nums ${
        on
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      T{tier}
    </span>
  );
}

function MethodChip({ method }: { method: Method }) {
  const m = METHOD_META[method];
  return (
    <span
      title={method}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.cls}`}
    >
      {m.short}
    </span>
  );
}

// ─── Data sources: non-image depth ─────────────────────────────────────────

function SourceDepthSection({
  initialWebsiteCrawlMaxPages,
  onSaved,
}: {
  initialWebsiteCrawlMaxPages: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [websitePages, setWebsitePages] = useState(initialWebsiteCrawlMaxPages);
  const [saved, setSaved] = useState(initialWebsiteCrawlMaxPages);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = websitePages !== saved;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({ websiteCrawlMaxPages: websitePages });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved(r.data.atlasWebsiteCrawlMaxPages);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<SlidersHorizontal className="text-muted-foreground h-4 w-4" />}
      title="Source depth"
      subtitle="Non-image crawl depth. Reviews are pulled from Google in full; website pages set the content-crawl depth."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Website pages (crawl)" value={websitePages} min={1} max={20} onChange={setWebsitePages} disabled={pending} />
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

// ─── Gather (images pulled per source) ─────────────────────────────────────

function GatherSection({
  initialGatherGoogleImages,
  initialGatherWebsiteImages,
  initialGatherInstagramPosts,
  onSaved,
}: {
  initialGatherGoogleImages: number;
  initialGatherWebsiteImages: number;
  initialGatherInstagramPosts: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [g, setG] = useState(initialGatherGoogleImages);
  const [w, setW] = useState(initialGatherWebsiteImages);
  const [posts, setPosts] = useState(initialGatherInstagramPosts);
  const [saved, setSaved] = useState({
    g: initialGatherGoogleImages,
    w: initialGatherWebsiteImages,
    posts: initialGatherInstagramPosts,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = g !== saved.g || w !== saved.w || posts !== saved.posts;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        gatherGoogleImages: g,
        gatherWebsiteImages: w,
        gatherInstagramPosts: posts,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        g: r.data.atlasGatherGoogleImages,
        w: r.data.atlasGatherWebsiteImages,
        posts: r.data.atlasGatherInstagramPosts,
      });
      setG(r.data.atlasGatherGoogleImages);
      setW(r.data.atlasGatherWebsiteImages);
      setPosts(r.data.atlasGatherInstagramPosts);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<ImageIcon className="text-muted-foreground h-4 w-4" />}
      title="Gather"
      subtitle="Image candidates pulled per source into the pool (≤10 each), pre-sorted as they arrive — not how many get analyzed or saved."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Google images" value={g} min={0} max={10} onChange={setG} disabled={pending} />
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Website images" value={w} min={0} max={10} onChange={setW} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram posts" value={posts} min={0} max={30} onChange={setPosts} disabled={pending} />
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

// ─── Vision Params (how many saved images get analyzed) ─────────────────────

function VisionParamsSection({
  initialImageVisionEnabled,
  initialAnalyzeGoogleImages,
  initialAnalyzeWebsiteImages,
  initialAnalyzeInstagramImages,
  initialSaveTotalImages,
  initialImageAnalysisPrompt,
  initialImageSortingPrompt,
  onSaved,
}: {
  initialImageVisionEnabled: boolean;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeWebsiteImages: number;
  initialAnalyzeInstagramImages: number;
  initialSaveTotalImages: number;
  initialImageAnalysisPrompt: string;
  initialImageSortingPrompt: string;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [vision, setVision] = useState(initialImageVisionEnabled);
  const [g, setG] = useState(initialAnalyzeGoogleImages);
  const [w, setW] = useState(initialAnalyzeWebsiteImages);
  const [ig, setIg] = useState(initialAnalyzeInstagramImages);
  const [saveTotal, setSaveTotal] = useState(initialSaveTotalImages);
  const [analysisPrompt, setAnalysisPrompt] = useState(initialImageAnalysisPrompt);
  const [sortingPrompt, setSortingPrompt] = useState(initialImageSortingPrompt);
  const [saved, setSaved] = useState({
    g: initialAnalyzeGoogleImages,
    w: initialAnalyzeWebsiteImages,
    ig: initialAnalyzeInstagramImages,
    saveTotal: initialSaveTotalImages,
    analysisPrompt: initialImageAnalysisPrompt,
    sortingPrompt: initialImageSortingPrompt,
  });
  const [togglePending, startToggle] = useTransition();
  const [savePending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty =
    g !== saved.g ||
    w !== saved.w ||
    ig !== saved.ig ||
    saveTotal !== saved.saveTotal ||
    analysisPrompt !== saved.analysisPrompt ||
    sortingPrompt !== saved.sortingPrompt;

  const flipVision = () => {
    setError(null);
    const next = !vision;
    setVision(next);
    startToggle(async () => {
      const r = await updateAtlasConfig({ imageVisionEnabled: next });
      if (!r.ok) {
        setVision(!next);
        setError(r.error);
        return;
      }
      onSaved(r.data.updatedAt);
    });
  };

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    startSave(async () => {
      const r = await updateAtlasConfig({
        analyzeGoogleImages: g,
        analyzeWebsiteImages: w,
        analyzeInstagramImages: ig,
        saveTotalImages: saveTotal,
        imageAnalysisPrompt: analysisPrompt,
        imageSortingPrompt: sortingPrompt,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        g: r.data.atlasAnalyzeGoogleImages,
        w: r.data.atlasAnalyzeWebsiteImages,
        ig: r.data.atlasAnalyzeInstagramImages,
        saveTotal: r.data.atlasSaveTotalImages,
        analysisPrompt: r.data.atlasImageAnalysisPrompt,
        sortingPrompt: r.data.atlasImageSortingPrompt,
      });
      setG(r.data.atlasAnalyzeGoogleImages);
      setW(r.data.atlasAnalyzeWebsiteImages);
      setIg(r.data.atlasAnalyzeInstagramImages);
      setSaveTotal(r.data.atlasSaveTotalImages);
      setAnalysisPrompt(r.data.atlasImageAnalysisPrompt);
      setSortingPrompt(r.data.atlasImageSortingPrompt);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<Eye className="text-muted-foreground h-4 w-4" />}
      title="Vision Params"
      subtitle="Vision describes each gathered image, then a text model ranks them best→worst. Caps bound the vision pass; Save keeps the best N overall."
    >
      <div className="mt-5">
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Eye className="text-muted-foreground h-4 w-4" />
            Enable vision
            <span className="text-muted-foreground text-[11px]">(the cost driver)</span>
          </span>
          <Switch on={vision} pending={togglePending} onClick={flipVision} label="Toggle image vision" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Analyze Google images" value={g} min={0} max={10} onChange={setG} disabled={savePending || !vision} />
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Analyze Website images" value={w} min={0} max={10} onChange={setW} disabled={savePending || !vision} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Analyze Instagram images" value={ig} min={0} max={20} onChange={setIg} disabled={savePending || !vision} />
      </div>

      <div className="mt-4">
        <NumberField
          icon={<ImageIcon className="text-muted-foreground h-4 w-4" />}
          label="Save (final, all sources combined)"
          value={saveTotal}
          min={0}
          max={20}
          onChange={setSaveTotal}
          disabled={savePending}
        />
      </div>

      <Collapsible summary="Edit vision & sorting prompts">
        <div className="space-y-4">
          <TextAreaField
            label="Image analysis prompt"
            value={analysisPrompt}
            onChange={setAnalysisPrompt}
            disabled={savePending || !vision}
          />
          <TextAreaField
            label="Image sorting prompt"
            value={sortingPrompt}
            onChange={setSortingPrompt}
            disabled={savePending || !vision}
          />
        </div>
      </Collapsible>

      <SaveRow pending={savePending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

const QUALITY_OPTIONS: { value: SynthesisQuality; label: string; hint: string }[] = [
  { value: "economy", label: "Economy", hint: "gpt-4o-mini" },
  { value: "standard", label: "Standard", hint: "gpt-4o" },
  { value: "high", label: "High", hint: "GPT-5.x" },
];

// ─── Data analysis: synthesis & cost ───────────────────────────────────────

function SynthCostSection({
  initialSynthesisQuality,
  initialPerRunCostCapUsd,
  onSaved,
}: {
  initialSynthesisQuality: SynthesisQuality;
  initialPerRunCostCapUsd: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [quality, setQuality] = useState<SynthesisQuality>(initialSynthesisQuality);
  const [costCap, setCostCap] = useState(initialPerRunCostCapUsd);
  const [saved, setSaved] = useState({
    quality: initialSynthesisQuality,
    costCap: initialPerRunCostCapUsd,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = quality !== saved.quality || costCap !== saved.costCap;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        synthesisQuality: quality,
        perRunCostCapUsd: costCap,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        quality: r.data.atlasSynthesisQuality,
        costCap: r.data.atlasPerRunCostCapUsd,
      });
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<Sparkles className="text-muted-foreground h-4 w-4" />}
      title="Analysis & cost"
      subtitle="The final synthesis model and the hard per-venue spend cap."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="text-muted-foreground h-4 w-4" />
            Synthesis quality
          </span>
          <select
            value={quality}
            disabled={pending}
            onChange={(e) => setQuality(e.target.value as SynthesisQuality)}
            className="border-border bg-card focus:border-foreground h-9 rounded-lg border px-2 text-sm outline-none disabled:opacity-50"
          >
            {QUALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} · {o.hint}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
          label="Cost cap (USD / venue)"
          value={costCap}
          min={0}
          max={50}
          decimals
          onChange={setCostCap}
          disabled={pending}
        />
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────

// ─── Cost estimate ───────────────────────────────────────────────────────
//
// Per-call USD rate card. MIRRORS the cost constants in the enricher
// (atlas-enrich-profile `COST`), plus the Google Places Details call that
// business-create-unit makes at create time. Approximate — enough to compare
// configurations, not for billing. Keep in sync with the enricher.
const COST_RATES = {
  googlePlaces: 0.017, // Places Details lookup at create (Pro SKU, ~$17/1k)
  apifyGoogleMaps: 0.05, // compass run: all reviews + venue photos
  firecrawlSearch: 0.002, // one channel-discovery web search
  perplexity: 0.01, // discovery fallback (sonar)
  apifyInstagram: 0.02, // IG profile scraper
  apifyFacebook: 0.02, // FB pages scraper
  firecrawlScrape: 0.01, // website content scrape
  visionPerImage: 0.002, // gpt-4o-mini vision, one image (detail:low)
  sort: 0.003, // gpt-4o-mini text sort
  synthEconomy: 0.005, // gpt-4o-mini synthesis
  synthStandard: 0.03, // gpt-4o synthesis (standard & high)
} as const;

const money = (n: number) => `$${n.toFixed(3)}`;

function CostSection({
  initialSourceTierCeiling,
  initialSynthesisQuality,
  initialImageVisionEnabled,
  initialAnalyzeGoogleImages,
  initialAnalyzeWebsiteImages,
  initialAnalyzeInstagramImages,
}: {
  initialSourceTierCeiling: number;
  initialSynthesisQuality: SynthesisQuality;
  initialImageVisionEnabled: boolean;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeWebsiteImages: number;
  initialAnalyzeInstagramImages: number;
}) {
  const [tier, setTier] = useState(initialSourceTierCeiling);
  const [quality, setQuality] = useState<SynthesisQuality>(initialSynthesisQuality);
  const [vision, setVision] = useState(initialImageVisionEnabled);
  const [g, setG] = useState(initialAnalyzeGoogleImages);
  const [w, setW] = useState(initialAnalyzeWebsiteImages);
  const [ig, setIg] = useState(initialAnalyzeInstagramImages);
  const [venues, setVenues] = useState(1);

  const social = tier >= 2; // tier ≥ 2 unlocks IG / FB / website / discovery
  const synthCost =
    quality === "economy" ? COST_RATES.synthEconomy : COST_RATES.synthStandard;
  const visionImgs = vision ? g + w + ig : 0;
  const visionActive = vision && visionImgs > 0;

  const lines: { label: string; detail: string; cost: number; active: boolean }[] = [
    { label: "Google Places details", detail: "create lookup", cost: COST_RATES.googlePlaces, active: true },
    { label: "Google reviews + photos", detail: "Apify Maps run", cost: COST_RATES.apifyGoogleMaps, active: true },
    { label: "Channel discovery — search", detail: "3 × Firecrawl search", cost: COST_RATES.firecrawlSearch * 3, active: social },
    { label: "Channel discovery — fallback", detail: "Perplexity", cost: COST_RATES.perplexity, active: social },
    { label: "Instagram", detail: "Apify run", cost: COST_RATES.apifyInstagram, active: social },
    { label: "Facebook", detail: "Apify run", cost: COST_RATES.apifyFacebook, active: social },
    { label: "Website content", detail: "Firecrawl scrape", cost: COST_RATES.firecrawlScrape, active: social },
    { label: "Image analysis — vision", detail: `${visionImgs} img × ${money(COST_RATES.visionPerImage)}`, cost: visionImgs * COST_RATES.visionPerImage, active: visionActive },
    { label: "Image sorting — text", detail: "1 call", cost: COST_RATES.sort, active: visionActive },
    { label: `Synthesis — ${quality}`, detail: quality === "economy" ? "gpt-4o-mini" : "gpt-4o", cost: synthCost, active: true },
  ];

  const perVenue = lines.filter((l) => l.active).reduce((s, l) => s + l.cost, 0);
  const total = perVenue * Math.max(1, venues);

  return (
    <SectionCard
      icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
      title="Per-venue cost estimate"
      subtitle="What-if external spend to enrich one new venue."
    >
      <Collapsible summary="Show cost breakdown">
      {/* Params */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Layers className="text-muted-foreground h-4 w-4" />
            Source tier ceiling
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`h-8 w-8 rounded-lg border text-sm font-semibold transition ${
                  tier === t
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:border-foreground/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="text-muted-foreground h-4 w-4" />
            Synthesis quality
          </span>
          <div className="flex gap-1">
            {(["economy", "standard", "high"] as SynthesisQuality[]).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                className={`h-8 rounded-lg border px-2.5 text-xs font-semibold capitalize transition ${
                  quality === q
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:border-foreground/40"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <Card
          className="md:col-span-2"
          icon={<Eye className="text-muted-foreground h-4 w-4" />}
          title="Vision analysis enabled"
          desc="When off, images save in source order and the vision/sort lines drop from the estimate."
          control={<Switch on={vision} pending={false} onClick={() => setVision(!vision)} label="Toggle vision" />}
        />

        {vision && (
          <>
            <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Analyze — Google" value={g} min={0} max={10} onChange={setG} disabled={false} />
            <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Analyze — Website" value={w} min={0} max={10} onChange={setW} disabled={false} />
            <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Analyze — Instagram" value={ig} min={0} max={20} onChange={setIg} disabled={false} />
          </>
        )}

        <NumberField icon={<Layers className="text-muted-foreground h-4 w-4" />} label="Number of venues" value={venues} min={1} max={5000} onChange={setVenues} disabled={false} />
      </div>

      {/* Breakdown */}
      <div className="border-border mt-6 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left font-medium">Source / step</th>
              <th className="px-4 py-2.5 text-left font-medium">Detail</th>
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
                <td className="text-muted-foreground px-4 py-2.5">{l.detail}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {l.active ? money(l.cost) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-background border-border border-t-2">
              <td className="px-4 py-3 font-semibold" colSpan={2}>
                Per venue
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {money(perVenue)}
              </td>
            </tr>
            {venues > 1 && (
              <tr className="bg-background border-border/60 border-t">
                <td className="text-muted-foreground px-4 py-2.5" colSpan={2}>
                  × {venues} venues
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
        Upper bound for a fresh venue. Rates are approximate per-call estimates
        and mirror the enricher&apos;s cost model; the per-run cost cap in
        “Analysis &amp; cost” hard-stops spend regardless. Tiers above T2 add
        link resolution (T3–T4) and gated heavy contents (T5) the enricher
        doesn&apos;t yet bill, so the estimate is flat past T2.
      </p>
      </Collapsible>
    </SectionCard>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────

// Native disclosure used to tuck the page's densest blocks (the per-tier
// source list, the vision prompts, the cost breakdown) out of the default
// view — open on demand, no JS state.
function Collapsible({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-5">
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

const PIPELINE: { stage: Pipeline; blurb: string }[] = [
  { stage: "Link", blurb: "resolve each source's URL" },
  { stage: "Contents", blurb: "fetch from every source" },
  { stage: "Analysis", blurb: "perceive, then reason" },
];

// Compact visual of the ADEA pipeline — every node is one of these three
// stages (see the Sources card). Link resolves URLs, Contents fetches from
// them, and Analysis (Text + Image perception → Cognition) writes the profile.
function PipelineStrip() {
  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border px-5 py-3.5">
      <span className="text-muted-foreground mr-1 text-[10px] font-semibold tracking-[0.14em] uppercase">
        ADEA pipeline
      </span>
      {PIPELINE.map(({ stage, blurb }, i) => (
        <Fragment key={stage}>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <span className="bg-foreground text-background flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
              {i + 1}
            </span>
            {stage}
            <span className="text-muted-foreground hidden text-xs font-normal sm:inline">
              — {blurb}
            </span>
          </span>
          {i < PIPELINE.length - 1 && (
            <ChevronRight className="text-muted-foreground/40 h-4 w-4" />
          )}
        </Fragment>
      ))}
    </div>
  );
}

// Uniform config card: icon + title + one-line subtitle + optional status,
// then the controls. The single wrapper keeps every section consistent.
function SectionCard({
  icon,
  title,
  subtitle,
  status,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-display text-base font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>
      {children}
    </section>
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
    <section className={`border-border bg-card rounded-2xl border p-6 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-6">
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

function Switch({
  on,
  pending,
  onClick,
  label,
}: {
  on: boolean;
  pending: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={on}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        on ? "bg-foreground" : "bg-muted"
      }`}
    >
      <span
        className={`bg-background inline-block h-5 w-5 rounded-full shadow transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        rows={4}
        maxLength={4000}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-card focus:border-foreground min-h-24 rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none disabled:opacity-50"
      />
    </label>
  );
}

function NumberField({
  icon,
  label,
  value,
  min,
  max,
  decimals,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: boolean;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <input
        type="number"
        inputMode={decimals ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={decimals ? 0.25 : 1}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (Number.isNaN(raw)) return;
          const n = decimals ? Math.round(raw * 100) / 100 : Math.round(raw);
          onChange(Math.max(min, Math.min(max, n)));
        }}
        className="border-border bg-card focus:border-foreground h-9 w-24 rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
      />
    </label>
  );
}

function SaveRow({
  pending,
  dirty,
  ok,
  onClick,
}: {
  pending: boolean;
  dirty: boolean;
  ok: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || !dirty}
        className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </>
        ) : (
          "Save"
        )}
      </button>
      {ok && !dirty && (
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Saved
        </span>
      )}
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="font-medium">{message}</p>
    </div>
  );
}
