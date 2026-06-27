"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  DollarSign,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  Instagram,
  Layers,
  Link2,
  Loader2,
  Lock,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { updateAtlasConfig, type SynthesisQuality } from "./actions";

// ADEA node catalog — a faithful mirror of the "🌐 Atlas" Notion DB
// (data source 36fa9bf3…, 28 rows). Each row is a NODE carrying its canonical
// Notion fields:
//   • Step (S0–S6) — Notion's pipeline step (shown as the S-badge).
//   • Pipeline — Link · Contents · Analysis · Cognition · Extra (Notion select).
//   • Methods — providers from Notion's "Methods". For Link nodes the order is
//     the seed→fallback chain: Mesita Input → Google Places → Agent Y.
//   • Source level (0–5) — the admin DEPTH gate, a DIFFERENT axis than Step. It
//     is the enricher's EXEC_*_STEP gating (_shared/atlas-config.ts) that the
//     1–5 dial drives. Map: L1=S1 · L2=S2+S3 · L3=S4 · L4=S5 vision · L0=always
//     on (S0 spine + the S5 synthesis "Place About/Tags/Category" + S6 storage,
//     which all run regardless of the ceiling).
// Read-only — selection is driven by the level ceiling, not by editing chips.
//
// Two Notion↔code divergences (Notion is the design source of truth):
//   • Rappi Page Link is in Notion (S3) but the shipped enricher REMOVED Rappi
//     (atlas-channel-discovery.ts DiscoveryField; supabase 14be08b "Uber Eats
//     only"; admin ec5423f dropped rappi_url). Shown to match Notion; runtime
//     currently skips it.
//   • L5 has no nodes: the EF's heavyScrapeLayer (EXEC_HEAVY_STEP=5) is defined
//     but UNUSED in atlas-enrich-place and Notion has no heavy-scrape rows, so
//     the old "OpenTable/TripAdvisor Page Contents" nodes were dropped.
type Pipeline = "Link" | "Contents" | "Analysis" | "Cognition" | "Extra";

// Notion "Methods" multi-select options (verbatim, incl. the X/Y agent suffixes).
type Method =
  | "Google Places"
  | "Apify"
  | "Mesita Input"
  | "Firecrawl Crawl"
  | "OpenAI LLM"
  | "OpenAI Vision"
  | "Meta Graph API"
  | "Firecrawl Scrape"
  | "Firecrawl Search and Perplexity Agent Y"
  | "Perplexity Agent X"
  | "Supabase";

type Step = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

type Level = 0 | 1 | 2 | 3 | 4 | 5;

type AdeaNode = {
  name: string;
  pipeline: Pipeline;
  step: Step;
  level: Level;
  methods: Method[];
};

const FC_PPLX_AGENT: Method[] = [
  "Mesita Input",
  "Google Places",
  "Firecrawl Search and Perplexity Agent Y",
];

const ADEA_NODES: AdeaNode[] = [
  // L0 · always-on — spine (S0), final synthesis (S5 write) & storage (S6)
  { name: "Google Business Page Link", pipeline: "Link", step: "S0", level: 0, methods: ["Mesita Input"] },
  { name: "Mesita Page Link", pipeline: "Link", step: "S0", level: 0, methods: ["Mesita Input"] },
  { name: "Cognition Engine", pipeline: "Cognition", step: "S0", level: 0, methods: ["OpenAI LLM"] },
  { name: "Place About", pipeline: "Analysis", step: "S5", level: 0, methods: ["OpenAI LLM"] },
  { name: "Place Tags", pipeline: "Analysis", step: "S5", level: 0, methods: ["OpenAI LLM"] },
  { name: "Place Category", pipeline: "Analysis", step: "S5", level: 0, methods: ["OpenAI LLM"] },
  { name: "Images Storing in Supabase", pipeline: "Extra", step: "S6", level: 0, methods: ["Supabase"] },
  // L1 · Google spine (S1)
  { name: "Google Business Page Profile", pipeline: "Contents", step: "S1", level: 1, methods: ["Google Places"] },
  { name: "Google Business Page Photos", pipeline: "Contents", step: "S1", level: 1, methods: ["Google Places"] },
  { name: "Google Business Page Reviews", pipeline: "Contents", step: "S1", level: 1, methods: ["Apify"] },
  // L2 · SERP (S2) + link discovery (S3, one Agent Y batch) — channel URLs + contacts
  { name: "SERP Page AI Summary", pipeline: "Analysis", step: "S2", level: 2, methods: ["Perplexity Agent X"] },
  { name: "Website Page Link", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  { name: "Instagram Page Link", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  { name: "Facebook Page Link", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  { name: "OpenTable Page Link", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  { name: "UberEats Page Link", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  // Rappi: in Notion (S3) but the shipped enricher REMOVED it — mirror Notion, runtime skips it.
  { name: "Rappi Page Link", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  { name: "TripAdvisor Page Link", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  { name: "Yelp Page Link", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  { name: "TikTok Page Link", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  { name: "Phone Number", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  { name: "Email Address", pipeline: "Link", step: "S3", level: 2, methods: FC_PPLX_AGENT },
  // L3 · source gather — parallel scrapers (S4)
  { name: "Website Page Contents", pipeline: "Contents", step: "S4", level: 3, methods: ["Firecrawl Crawl"] },
  { name: "Instagram Page Profile", pipeline: "Contents", step: "S4", level: 3, methods: ["Apify"] },
  { name: "Instagram Page Photos", pipeline: "Contents", step: "S4", level: 3, methods: ["Apify"] },
  { name: "Facebook Page Profile", pipeline: "Contents", step: "S4", level: 3, methods: ["Apify"] },
  // L4 · image perception — vision funnel (S5; text-perception leg dropped)
  { name: "Images Descriptions", pipeline: "Analysis", step: "S5", level: 4, methods: ["OpenAI Vision"] },
  { name: "Images Ranking and Sorting", pipeline: "Analysis", step: "S5", level: 4, methods: ["OpenAI LLM"] },
  // L5 · heavy third-party scrapes — reserved; EXEC_HEAVY_STEP unused, no Notion rows.
];

// Source-level metadata — depth levels 1–5; level 0 is the always-on spine,
// final synthesis & storage. Level 5 has no nodes (heavy-scrape layer unused).
const LEVELS: { level: Level; blurb: string; alwaysOn?: boolean }[] = [
  { level: 0, blurb: "Identity spine, final synthesis & storage (S0 · S5 write · S6)", alwaysOn: true },
  { level: 1, blurb: "Google data — profile, photos & reviews (S1)" },
  { level: 2, blurb: "SERP + link discovery — all channel links & contacts (S2–S3)" },
  { level: 3, blurb: "Source contents — website, Instagram & Facebook (S4)" },
  { level: 4, blurb: "Image perception — vision descriptions & ranking (S5)" },
  { level: 5, blurb: "Heavy third-party scrapes — reserved; no active nodes" },
];

const CEILING_MIN = 1;
const CEILING_MAX = 5;

// Per-method chip tint, keyed to the provider family (spine, Google,
// Firecrawl, Apify, OpenAI, Meta). The chip shows the method's full spec name —
// no abbreviations. Light-themed admin surface, subtle tints only.
const METHOD_CLS: Record<Method, string> = {
  "Mesita Input": "border-foreground/20 bg-foreground/5 text-foreground/80",
  "Google Places": "border-red-500/25 bg-red-500/10 text-red-600",
  "Apify": "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  "Firecrawl Crawl": "border-amber-500/25 bg-amber-500/10 text-amber-700",
  "Firecrawl Scrape": "border-amber-500/25 bg-amber-500/10 text-amber-700",
  "Firecrawl Search and Perplexity Agent Y":
    "border-orange-500/25 bg-orange-500/10 text-orange-700",
  "Perplexity Agent X": "border-purple-500/25 bg-purple-500/10 text-purple-600",
  "OpenAI LLM": "border-sky-500/25 bg-sky-500/10 text-sky-700",
  "OpenAI Vision": "border-violet-500/25 bg-violet-500/10 text-violet-600",
  "Meta Graph API": "border-blue-500/25 bg-blue-500/10 text-blue-700",
  "Supabase": "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
};

export function AtlasConfigurationClient(props: {
  initialSourceTierCeiling: number;
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
  initialVisionQuality: SynthesisQuality;
  initialUpdatedAt: string | null;
}) {
  const [updatedAt, setUpdatedAt] = useState(props.initialUpdatedAt);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
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
        initialLevelCeiling={props.initialSourceTierCeiling}
        onSaved={setUpdatedAt}
      />
      <GatherSection
        initialWebsiteCrawlMaxPages={props.initialWebsiteCrawlMaxPages}
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
      <ModelsSection
        initialSynthesisQuality={props.initialSynthesisQuality}
        initialVisionQuality={props.initialVisionQuality}
        onSaved={setUpdatedAt}
      />
    </div>
  );
}

export function AtlasCalculatorClient(props: {
  initialSourceTierCeiling: number;
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialImageVisionEnabled: boolean;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeWebsiteImages: number;
  initialAnalyzeInstagramImages: number;
}) {
  return (
    <CostSection
      standalone
      initialSourceTierCeiling={props.initialSourceTierCeiling}
      initialSynthesisQuality={props.initialSynthesisQuality}
      initialVisionQuality={props.initialVisionQuality}
      initialImageVisionEnabled={props.initialImageVisionEnabled}
      initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
      initialAnalyzeWebsiteImages={props.initialAnalyzeWebsiteImages}
      initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
    />
  );
}

// ─── Sourcing ────────────────────────────────────────────────────────────

function SourcesSection({
  initialLevelCeiling,
  onSaved,
}: {
  initialLevelCeiling: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [ceiling, setCeiling] = useState(initialLevelCeiling);
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
      subtitle="Choose the highest source level to include. Level 0 always runs — identity links and final synthesis. Levels at or below your ceiling run in order; higher levels are skipped."
      status={pending ? <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" /> : null}
    >
      <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <label className="text-sm font-medium">Max source level</label>
        <div className="flex flex-wrap items-center gap-1.5">
          <Layers className="text-muted-foreground h-4 w-4" />
          <span
            title="Required — core links and profile writing can't be turned off"
            className="border-foreground/30 bg-foreground/5 text-muted-foreground flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold"
          >
            L0 <span className="opacity-70">· required</span>
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
              L{t}
            </button>
          ))}
        </div>
      </div>

      <Collapsible summary={`Sources included through level ${ceiling}`}>
        <div className="flex flex-col gap-5">
          {LEVELS.map(({ level, blurb, alwaysOn }) => {
            const levelActive = alwaysOn || level <= ceiling;
            const nodes = ADEA_NODES.filter((n) => n.level === level);
            return (
              <div key={level} className={levelActive ? "" : "opacity-50"}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <LevelBadge level={level} on={levelActive} />
                  <span className="text-sm font-medium">{blurb}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {alwaysOn
                      ? "· required"
                      : levelActive
                        ? "· included"
                        : "· not included"}
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
    Extra: { Icon: Database, cls: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
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

function LevelBadge({ level, on }: { level: Level; on: boolean }) {
  return (
    <span
      className={`inline-flex h-6 min-w-9 items-center justify-center rounded-md border px-1.5 text-xs font-semibold tabular-nums ${
        on
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      L{level}
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

// ─── Gather (per-source fetch depth: pages, images, posts) ──────────────────
// One card for every "how much to pull" knob — website crawl depth plus the
// image/post candidate counts per source. Four fields sit on one row at wide
// widths, so the card fills the space instead of a half-empty grid.

function GatherSection({
  initialWebsiteCrawlMaxPages,
  initialGatherGoogleImages,
  initialGatherWebsiteImages,
  initialGatherInstagramPosts,
  onSaved,
}: {
  initialWebsiteCrawlMaxPages: number;
  initialGatherGoogleImages: number;
  initialGatherWebsiteImages: number;
  initialGatherInstagramPosts: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [pages, setPages] = useState(initialWebsiteCrawlMaxPages);
  const [g, setG] = useState(initialGatherGoogleImages);
  const [w, setW] = useState(initialGatherWebsiteImages);
  const [posts, setPosts] = useState(initialGatherInstagramPosts);
  const [saved, setSaved] = useState({
    pages: initialWebsiteCrawlMaxPages,
    g: initialGatherGoogleImages,
    w: initialGatherWebsiteImages,
    posts: initialGatherInstagramPosts,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty =
    pages !== saved.pages ||
    g !== saved.g ||
    w !== saved.w ||
    posts !== saved.posts;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        websiteCrawlMaxPages: pages,
        gatherGoogleImages: g,
        gatherWebsiteImages: w,
        gatherInstagramPosts: posts,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        pages: r.data.atlasWebsiteCrawlMaxPages,
        g: r.data.atlasGatherGoogleImages,
        w: r.data.atlasGatherWebsiteImages,
        posts: r.data.atlasGatherInstagramPosts,
      });
      setPages(r.data.atlasWebsiteCrawlMaxPages);
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
      title="Collection"
      subtitle="How much raw material ADEA collects before analysis. These limits set website crawl depth and how many images or posts to fetch — not how many end up on the profile."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NumberField icon={<SlidersHorizontal className="text-muted-foreground h-4 w-4" />} label="Website subpages" value={pages} min={1} max={20} onChange={setPages} disabled={pending} />
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Google images" value={g} min={0} max={10} onChange={setG} disabled={pending} />
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Website images" value={w} min={0} max={10} onChange={setW} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram posts" value={posts} min={0} max={30} onChange={setPosts} disabled={pending} />
      </div>

      {/* Fixed per-source pre-sort — read-only. Each pool arrives already ranked
          by these rules as candidates land; only the counts above are tunable. */}
      <div className="border-border bg-background mt-4 rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <Lock className="text-muted-foreground h-3.5 w-3.5" />
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
            How each source is ranked
          </p>
        </div>
        <p className="text-muted-foreground mt-1.5 max-w-3xl text-xs leading-relaxed">
          Ranking is automatic and can&apos;t be changed. The numbers above only
          control how many items ADEA takes from the top of each ranked list.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <ImageIcon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">Google</span> — Google Places order
              (hero photos first).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Globe className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">Website</span> — AI ranks crawled
              images; place shots rise, logos and banners sink.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Instagram className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">Instagram</span> — highest-liked
              posts first (video covers included).
            </span>
          </li>
        </ul>
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
      title="Photo Analysis"
      subtitle="AI describes each photo, ranks them best to worst, then keeps the top picks for the profile. Turn off to skip analysis and save images in source order."
    >
      <div className="mt-5">
        <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4 xl:flex-row xl:items-center xl:justify-between">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Eye className="text-muted-foreground h-4 w-4" />
            Enable image analysis
            <span className="text-muted-foreground text-[11px]">(largest cost driver)</span>
          </span>
          <Switch on={vision} pending={togglePending} onClick={flipVision} label="Toggle image vision" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Analyze Google images" value={g} min={0} max={10} onChange={setG} disabled={savePending || !vision} />
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Analyze Website images" value={w} min={0} max={10} onChange={setW} disabled={savePending || !vision} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Analyze Instagram images" value={ig} min={0} max={20} onChange={setIg} disabled={savePending || !vision} />
      </div>

      <div className="mt-4">
        <NumberField
          icon={<ImageIcon className="text-muted-foreground h-4 w-4" />}
          label="Photos to keep on profile (all sources combined)"
          value={saveTotal}
          min={0}
          max={20}
          onChange={setSaveTotal}
          disabled={savePending}
        />
      </div>

      <Collapsible summary="Edit photo analysis prompts">
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
  { value: "high", label: "High", hint: "gpt-4o" },
];

// ─── Models (text synthesis model + image vision model) ─────────────────────

function ModelsSection({
  initialSynthesisQuality,
  initialVisionQuality,
  onSaved,
}: {
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [text, setText] = useState<SynthesisQuality>(initialSynthesisQuality);
  const [image, setImage] = useState<SynthesisQuality>(initialVisionQuality);
  const [saved, setSaved] = useState({
    text: initialSynthesisQuality,
    image: initialVisionQuality,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = text !== saved.text || image !== saved.image;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        synthesisQuality: text,
        visionQuality: image,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        text: r.data.atlasSynthesisQuality,
        image: r.data.atlasVisionQuality,
      });
      setText(r.data.atlasSynthesisQuality);
      setImage(r.data.atlasVisionQuality);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<Sparkles className="text-muted-foreground h-4 w-4" />}
      title="Models"
      subtitle="Which AI models write the profile (text) and analyze photos (vision)."
    >
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ModelSelect
          icon={<Brain className="text-muted-foreground h-4 w-4" />}
          label="Text model"
          hint="writes the profile"
          value={text}
          onChange={setText}
          disabled={pending}
        />
        <ModelSelect
          icon={<Eye className="text-muted-foreground h-4 w-4" />}
          label="Image model"
          hint="analyzes photos"
          value={image}
          onChange={setImage}
          disabled={pending}
        />
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

function ModelSelect({
  icon,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: SynthesisQuality;
  onChange: (v: SynthesisQuality) => void;
  disabled: boolean;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
        <span className="text-muted-foreground text-[11px] font-normal">· {hint}</span>
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as SynthesisQuality)}
        className="border-border bg-card focus:border-foreground h-9 rounded-lg border px-2 text-sm outline-none disabled:opacity-50"
      >
        {QUALITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} · {o.hint}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────

// ─── Cost estimate ───────────────────────────────────────────────────────
//
// Per-call USD rate card. MIRRORS the cost constants in the enricher
// (atlas-get-enriched-place `COST`), plus the Google Places Details call the
// enrichment makes at create time. Approximate — enough to compare
// configurations, not for billing. Keep in sync with the enricher.
const COST_RATES = {
  googlePlaces: 0.017, // Places Details lookup at create (Pro SKU, ~$17/1k)
  apifyGoogleMaps: 0.05, // compass run: all reviews + place photos
  firecrawlSearch: 0.002, // one channel-discovery web search
  perplexity: 0.01, // discovery fallback (sonar)
  apifyInstagram: 0.02, // IG profile scraper
  apifyFacebook: 0.02, // FB pages scraper
  firecrawlScrape: 0.01, // website content scrape
  visionEconomy: 0.002, // gpt-4o-mini vision, one image (detail:low)
  visionStandard: 0.01, // gpt-4o vision, one image
  sort: 0.003, // gpt-4o-mini text sort
  synthEconomy: 0.005, // gpt-4o-mini synthesis
  synthStandard: 0.03, // gpt-4o synthesis (standard & high)
} as const;

// Rough wall-clock seconds per step. The gather steps overlap (the enricher
// fires them with Promise.all), so the per-place total uses the stage model in
// CostSection (pre + max(gather) + post), NOT the column sum.
const TIME_RATES = {
  googlePlaces: 2, // Places Details lookup
  apifyGoogleMaps: 45, // Apify reviews + photos — the slow one
  discoverySearch: 6, // 3 × Firecrawl search
  discoveryFallback: 4, // Perplexity
  apifyInstagram: 25, // Apify IG run
  apifyFacebook: 15, // Apify FB run
  firecrawlScrape: 18, // website crawl
  visionEconomy: 1.0, // gpt-4o-mini vision / image
  visionStandard: 1.8, // gpt-4o vision / image
  sort: 3, // text sort
  synthEconomy: 6, // gpt-4o-mini synthesis
  synthStandard: 12, // gpt-4o synthesis
} as const;

const money = (n: number) => `$${n.toFixed(3)}`;

// Compact duration: 45s · 1m 20s · 2h 5m.
const fmtTime = (secs: number) => {
  const s = Math.round(secs);
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
};

const STAGE_META = {
  pre: { label: "Setup", hint: "Runs before sources are fetched" },
  gather: { label: "Gather", hint: "Sources fetched in parallel — time is the slowest step" },
  post: { label: "Analyze & write", hint: "Vision, sorting, and profile synthesis" },
} as const;

type CostLine = {
  label: string;
  detail: string;
  cost: number;
  secs: number;
  stage: "pre" | "gather" | "post";
  active: boolean;
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

function CalculatorView({
  level,
  setLevel,
  quality,
  setQuality,
  imageModel,
  setImageModel,
  vision,
  setVision,
  g,
  setG,
  w,
  setW,
  ig,
  setIg,
  places,
  setPlaces,
  sourceGather,
  perceptionLayer,
  active,
  lines,
  perPlace,
  total,
  perPlaceSecs,
  totalSecs,
}: {
  level: number;
  setLevel: (t: number) => void;
  quality: SynthesisQuality;
  setQuality: (q: SynthesisQuality) => void;
  imageModel: SynthesisQuality;
  setImageModel: (q: SynthesisQuality) => void;
  vision: boolean;
  setVision: (v: boolean) => void;
  g: number;
  setG: (v: number) => void;
  w: number;
  setW: (v: number) => void;
  ig: number;
  setIg: (v: number) => void;
  places: number;
  setPlaces: (v: number) => void;
  sourceGather: boolean;
  perceptionLayer: boolean;
  active: CostLine[];
  lines: CostLine[];
  perPlace: number;
  total: number;
  perPlaceSecs: number;
  totalSecs: number;
}) {
  const levelBlurb = LEVELS.find((t) => t.level === level)?.blurb ?? "";
  const stages = (["pre", "gather", "post"] as const).filter((stage) =>
    lines.some((l) => l.stage === stage && l.active),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm leading-relaxed">
        Estimate cost and runtime for enriching a new place. Adjust inputs to compare
        configurations — figures are approximate, not billing.
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-start">
        <aside className="flex flex-col gap-4">
          <CalcPanel title="Source level" icon={<Layers className="h-3.5 w-3.5" />}>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLevel(t)}
                  className={`h-9 flex-1 rounded-lg border text-xs font-semibold transition ${
                    level === t
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:border-foreground/40"
                  }`}
                >
                  L{t}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground mt-2.5 text-xs leading-relaxed">{levelBlurb}</p>
          </CalcPanel>

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
              {vision && perceptionLayer && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">Image model</span>
                    <QualityPicker value={imageModel} onChange={setImageModel} />
                  </div>
                  <div className="border-border space-y-0.5 border-t pt-2">
                    <CalcStepper label="Google photos" value={g} min={0} max={10} onChange={setG} />
                    <CalcStepper
                      label="Website photos"
                      value={w}
                      min={0}
                      max={10}
                      onChange={setW}
                      disabled={!sourceGather}
                    />
                    <CalcStepper
                      label="Instagram photos"
                      value={ig}
                      min={0}
                      max={20}
                      onChange={setIg}
                      disabled={!sourceGather}
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

function CostSection({
  standalone = false,
  initialSourceTierCeiling,
  initialSynthesisQuality,
  initialVisionQuality,
  initialImageVisionEnabled,
  initialAnalyzeGoogleImages,
  initialAnalyzeWebsiteImages,
  initialAnalyzeInstagramImages,
}: {
  standalone?: boolean;
  initialSourceTierCeiling: number;
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialImageVisionEnabled: boolean;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeWebsiteImages: number;
  initialAnalyzeInstagramImages: number;
}) {
  const [level, setLevel] = useState(initialSourceTierCeiling);
  const [quality, setQuality] = useState<SynthesisQuality>(initialSynthesisQuality);
  const [imageModel, setImageModel] = useState<SynthesisQuality>(initialVisionQuality);
  const [vision, setVision] = useState(initialImageVisionEnabled);
  const [g, setG] = useState(initialAnalyzeGoogleImages);
  const [w, setW] = useState(initialAnalyzeWebsiteImages);
  const [ig, setIg] = useState(initialAnalyzeInstagramImages);
  const [places, setPlaces] = useState(1);

  const linkDiscovery = level >= 2;
  const sourceGather = level >= 3;
  const perceptionLayer = level >= 4;
  const synthCost =
    quality === "economy" ? COST_RATES.synthEconomy : COST_RATES.synthStandard;
  const synthSecs =
    quality === "economy" ? TIME_RATES.synthEconomy : TIME_RATES.synthStandard;
  const visionImgs = vision ? g + (sourceGather ? w + ig : 0) : 0;
  const visionActive = perceptionLayer && vision && visionImgs > 0;
  const visionCostPer =
    imageModel === "economy" ? COST_RATES.visionEconomy : COST_RATES.visionStandard;
  const visionSecsPer =
    imageModel === "economy" ? TIME_RATES.visionEconomy : TIME_RATES.visionStandard;

  // Each line: cost (USD) + secs (duration) + stage for the wall-clock model.
  // pre = serial before gather · gather = concurrent · post = serial after.
  const lines: CostLine[] = [
    { label: "Google Places details", detail: "create lookup", cost: COST_RATES.googlePlaces, secs: TIME_RATES.googlePlaces, stage: "pre", active: true },
    { label: "Google reviews + photos", detail: "Apify Maps run", cost: COST_RATES.apifyGoogleMaps, secs: TIME_RATES.apifyGoogleMaps, stage: "gather", active: true },
    { label: "Channel discovery — search", detail: "3 × Firecrawl search", cost: COST_RATES.firecrawlSearch * 3, secs: TIME_RATES.discoverySearch, stage: "pre", active: linkDiscovery },
    { label: "Channel discovery — agent", detail: "Perplexity Agent validate", cost: COST_RATES.perplexity, secs: TIME_RATES.discoveryFallback, stage: "pre", active: linkDiscovery },
    { label: "Instagram", detail: "Apify run", cost: COST_RATES.apifyInstagram, secs: TIME_RATES.apifyInstagram, stage: "gather", active: sourceGather },
    { label: "Facebook", detail: "Apify run", cost: COST_RATES.apifyFacebook, secs: TIME_RATES.apifyFacebook, stage: "gather", active: sourceGather },
    { label: "Website content", detail: "Firecrawl crawl", cost: COST_RATES.firecrawlScrape, secs: TIME_RATES.firecrawlScrape, stage: "gather", active: sourceGather },
    { label: "Image analysis — vision", detail: `${visionImgs} img × ${money(visionCostPer)}`, cost: visionImgs * visionCostPer, secs: visionImgs * visionSecsPer, stage: "post", active: visionActive },
    { label: "Image sorting — text", detail: "1 call", cost: COST_RATES.sort, secs: TIME_RATES.sort, stage: "post", active: visionActive },
    { label: `Synthesis — ${quality}`, detail: quality === "economy" ? "gpt-4o-mini" : "gpt-4o", cost: synthCost, secs: synthSecs, stage: "post", active: true },
  ];

  const active = lines.filter((l) => l.active);
  const perPlace = active.reduce((s, l) => s + l.cost, 0);
  const total = perPlace * Math.max(1, places);
  // Wall-clock: serial pre + the SLOWEST concurrent gather + serial post.
  const preSecs = active.filter((l) => l.stage === "pre").reduce((s, l) => s + l.secs, 0);
  const gatherSecs = active
    .filter((l) => l.stage === "gather")
    .reduce((mx, l) => Math.max(mx, l.secs), 0);
  const postSecs = active.filter((l) => l.stage === "post").reduce((s, l) => s + l.secs, 0);
  const perPlaceSecs = preSecs + gatherSecs + postSecs;
  const totalSecs = perPlaceSecs * Math.max(1, places);

  if (standalone) {
    return (
      <CalculatorView
        level={level}
        setLevel={setLevel}
        quality={quality}
        setQuality={setQuality}
        imageModel={imageModel}
        setImageModel={setImageModel}
        vision={vision}
        setVision={setVision}
        g={g}
        setG={setG}
        w={w}
        setW={setW}
        ig={ig}
        setIg={setIg}
        places={places}
        setPlaces={setPlaces}
        sourceGather={sourceGather}
        perceptionLayer={perceptionLayer}
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
            <Layers className="text-muted-foreground h-4 w-4" />
            Source level limit
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLevel(t)}
                className={`h-8 w-8 rounded-lg border text-sm font-semibold transition ${
                  level === t
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:border-foreground/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

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
            <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Analyze — Website" value={w} min={0} max={10} onChange={setW} disabled={!sourceGather} />
            <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Analyze — Instagram" value={ig} min={0} max={20} onChange={setIg} disabled={!sourceGather} />
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
        Approximate per-step costs based on the enricher&apos;s rate card. Gather
        steps run in parallel, so total time is pre-work + slowest gather step +
        post-work — not the sum of every row. Batch time assumes places run
        one after another. Level 5 adds heavy Apify scrapes not yet reflected here.
      </p>
      </Collapsible>
    </SectionCard>
  );
}

// Shared economy/standard/high segmented picker used by the calculator.
function QualityPicker({
  value,
  onChange,
}: {
  value: SynthesisQuality;
  onChange: (v: SynthesisQuality) => void;
}) {
  return (
    <div className="flex gap-1">
      {(["economy", "standard", "high"] as SynthesisQuality[]).map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onChange(q)}
          className={`h-8 rounded-lg border px-2.5 text-xs font-semibold capitalize transition ${
            value === q
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card hover:border-foreground/40"
          }`}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────

// Native disclosure used to tuck the page's densest blocks (the per-level
// source list, the vision prompts, the cost breakdown) out of the default
// view — open on demand, no JS state.
function Collapsible({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group mt-5" open={defaultOpen || undefined}>
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
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
function PipelineStrip() {
  return (
    <div className="border-border bg-card rounded-2xl border p-4 sm:p-5">
      <p className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-[0.14em] uppercase">
        How ADEA works
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
    <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-display text-base font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
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
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="flex items-start gap-2 text-sm font-medium leading-snug">
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
        className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
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
