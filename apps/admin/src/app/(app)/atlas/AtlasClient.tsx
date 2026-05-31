"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Eye,
  Globe,
  Image as ImageIcon,
  Instagram,
  Layers,
  Loader2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { updateAtlasConfig, type SynthesisQuality } from "./actions";

// Atlas source catalog. Each source is a sub-pipeline of distinct NODES,
// mirroring the Atlas rows: "link" resolves the source's URL, "contents"
// scrapes that URL, "summary" runs an AI summary over it. Each node has its
// own tier and runs when step.tier <= the configured tier ceiling. The step
// chips in the console are READ-ONLY indicators — selection is driven
// indirectly by the tier ceiling, not by editing the chips. Google Business
// is the spine (always on).
//
// NOTE: when the enrich agent starts CONSUMING these params, it must mirror
// this same node catalog server-side (it resolves effective-enabled from the
// tier ceiling per node). Until then this is the config surface.
type AtlasStep = "link" | "profile" | "posts" | "contents" | "summary";

const STEP_LABEL: Record<AtlasStep, string> = {
  link: "Link",
  profile: "Profile",
  posts: "Posts",
  contents: "Contents",
  summary: "AI summary",
};

const ATLAS_SOURCES: {
  key: string;
  label: string;
  locked?: boolean;
  steps: { step: AtlasStep; tier: number }[];
}[] = [
  {
    key: "google_business",
    label: "Google Business",
    locked: true,
    steps: [
      { step: "link", tier: 1 },
      { step: "contents", tier: 1 },
    ],
  },
  {
    key: "mesita",
    label: "Mesita",
    locked: true,
    steps: [
      { step: "link", tier: 1 },
      { step: "contents", tier: 1 },
    ],
  },
  {
    key: "website",
    label: "Website",
    steps: [
      { step: "link", tier: 2 },
      { step: "contents", tier: 2 },
    ],
  },
  {
    key: "instagram",
    label: "Instagram",
    steps: [
      { step: "link", tier: 2 },
      { step: "profile", tier: 2 },
      { step: "posts", tier: 2 },
    ],
  },
  {
    key: "facebook",
    label: "Facebook",
    steps: [
      { step: "link", tier: 2 },
      { step: "profile", tier: 2 },
    ],
  },
  {
    key: "serp",
    label: "SERP",
    steps: [
      { step: "summary", tier: 2 },
      { step: "contents", tier: 4 },
    ],
  },
  {
    key: "opentable",
    label: "OpenTable",
    steps: [
      { step: "link", tier: 3 },
      { step: "contents", tier: 4 },
    ],
  },
  {
    key: "tripadvisor",
    label: "TripAdvisor",
    steps: [
      { step: "link", tier: 3 },
      { step: "contents", tier: 4 },
    ],
  },
  { key: "yelp", label: "Yelp", steps: [{ step: "link", tier: 3 }] },
  { key: "ubereats", label: "UberEats", steps: [{ step: "link", tier: 3 }] },
  { key: "tiktok", label: "TikTok", steps: [{ step: "link", tier: 3 }] },
  { key: "youtube", label: "YouTube", steps: [{ step: "link", tier: 3 }] },
];

function stepEnabled(
  source: { locked?: boolean },
  step: { tier: number },
  ceiling: number,
): boolean {
  if (source.locked) return true;
  return step.tier <= ceiling;
}

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
    <div className="mt-8 flex flex-col gap-8">
      {updatedAt && (
        <p className="text-muted-foreground -mb-4 text-[11px]">
          Settings last changed{" "}
          {new Date(updatedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

      {/* ═══ Data sources ══════════════════════════════════════════ */}
      <StageGroup
        label="Data sources"
        desc="Which sources run, and how much non-image data to pull. The tier ceiling gates each source step (Link → resolve URL, Profile/Contents → read it). Google Business & Mesita are the spine and always run. Reviews come from Google only, via Apify (all of them — no limit)."
      >
        <div className="flex flex-col gap-6">
          <SourcesSection
            initialTierCeiling={props.initialSourceTierCeiling}
            onSaved={setUpdatedAt}
          />
          <SourceDepthSection
            initialWebsiteCrawlMaxPages={props.initialWebsiteCrawlMaxPages}
            onSaved={setUpdatedAt}
          />
        </div>
      </StageGroup>

      {/* ═══ Gather (pull per source) ══════════════════════════════ */}
      <StageGroup
        label="Gather — image candidates pulled per source"
        desc="Stage 1 of the image funnel: how many image candidates to PULL per source into the pool (≤10 each). Each source is pre-sorted as it comes in — Google in Google's order, Instagram by likes, and Website by a cheap text-LLM pass that reads the crawled HTML and ranks images hero-first (square-prioritised). Fewer, higher-signal candidates = less junk downstream."
      >
        <GatherSection
          initialGatherGoogleImages={props.initialGatherGoogleImages}
          initialGatherWebsiteImages={props.initialGatherWebsiteImages}
          initialGatherInstagramPosts={props.initialGatherInstagramPosts}
          onSaved={setUpdatedAt}
        />
      </StageGroup>

      {/* ═══ Vision Params (analyze → sort → save) ═════════════════ */}
      <StageGroup
        label="Vision Params"
        desc="Stage 2: AI over the gathered images. A VISION model describes each (the analysis prompt; one call per image, the expensive part), then a TEXT model ranks them best→worst (the sorting prompt; no images re-sent, so it's cheap). The analyze caps bound how many gathered images per source get the vision pass; the final Save cap then keeps only the best N overall — source-independent."
      >
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
      </StageGroup>

      {/* ═══ Analysis and Cost ═════════════════════════════════════ */}
      <StageGroup
        label="Analysis and Cost"
        desc="Stage 3: the final synthesis model (reads everything gathered → the canonical venue profile; OpenAI, not Perplexity, so it doesn't re-search the web and drift), plus a hard per-venue spend ceiling."
      >
        <SynthCostSection
          initialSynthesisQuality={props.initialSynthesisQuality}
          initialPerRunCostCapUsd={props.initialPerRunCostCapUsd}
          onSaved={setUpdatedAt}
        />
      </StageGroup>

      {/* ═══ Cost estimate ══════════════════════════════════════════ */}
      <StageGroup
        label="Cost to create one venue"
        desc="A what-if estimate of the external spend to research + enrich ONE new venue, broken down by source. Adjust the params below to see the impact. Numbers are upper-bound per-call estimates (USD) for a fresh venue — actual runs are usually cheaper, and the per-run cost cap hard-stops spend."
      >
        <CostSection
          initialSourceTierCeiling={props.initialSourceTierCeiling}
          initialSynthesisQuality={props.initialSynthesisQuality}
          initialImageVisionEnabled={props.initialImageVisionEnabled}
          initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
          initialAnalyzeWebsiteImages={props.initialAnalyzeWebsiteImages}
          initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
        />
      </StageGroup>
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
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <Globe className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Sources
        </h2>
        {pending && <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />}
      </div>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        Set the tier ceiling — each source step
        (<span className="text-foreground font-medium">Link</span> resolves its
        URL, <span className="text-foreground font-medium">Profile</span>/
        <span className="text-foreground font-medium">Contents</span> read it,{" "}
        <span className="text-foreground font-medium">Posts</span> pulls
        posts/photos, <span className="text-foreground font-medium">AI summary</span>{" "}
        condenses it) runs when its tier is at or above the ceiling. The chips
        below just show what&apos;s on at the current ceiling — they aren&apos;t
        edited directly. Google Business &amp; Mesita are the spine and always run.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Tier ceiling</label>
        <div className="flex items-center gap-1.5">
          <Layers className="text-muted-foreground h-4 w-4" />
          {[1, 2, 3, 4].map((t) => (
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

      <div className="mt-5 flex flex-col gap-2">
        {ATLAS_SOURCES.map((src) => (
          <div
            key={src.key}
            className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {src.label}
              {src.locked && (
                <span className="text-muted-foreground text-[11px]">· spine</span>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {src.steps.map((st) => {
                const on = stepEnabled(src, st, ceiling);
                // Read-only indicator: the chip reflects whether this step is
                // on at the current tier ceiling. Selection is driven by the
                // ceiling, not by editing chips.
                return (
                  <span
                    key={st.step}
                    title={`Tier ${st.tier}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground opacity-60"
                    }`}
                  >
                    {STEP_LABEL[st.step]}
                    <span className="opacity-60">T{st.tier}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <ErrorNote message={error} />}
    </section>
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
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Source depth
        </h2>
      </div>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        How much non-image data to pull per source. Reviews come from Google
        via Apify (all of them — no limit); website pages = the menu/content
        crawl depth.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Website pages (crawl)" value={websitePages} min={1} max={20} onChange={setWebsitePages} disabled={pending} />
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </section>
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
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <ImageIcon className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Gather
        </h2>
      </div>
      <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
        How many image candidates to PULL per source — the input pool to the
        funnel. Each source is then pre-sorted: Google in Google&apos;s own
        order, Instagram by likes (one photo per post), and{" "}
        <span className="text-foreground font-medium">Website</span> by a cheap
        text-LLM pass that reads the crawled Firecrawl HTML (across the configured
        pages) and ranks every image hero-first — square dimensions prioritised,
        logos/icons buried. Pulling fewer, higher-signal candidates here is the
        first defense against junk. This is NOT how many get AI-analyzed (Vision
        Params) or finally saved (one cap below).
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Google images" value={g} min={0} max={10} onChange={setG} disabled={pending} />
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Website images" value={w} min={0} max={10} onChange={setW} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram posts" value={posts} min={0} max={30} onChange={setPosts} disabled={pending} />
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </section>
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
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <Eye className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Vision Params
        </h2>
      </div>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        Vision describes each gathered image (analysis prompt), then a text
        model ranks them best→worst (sorting prompt). The analyze caps bound how
        many GATHERED images per source get the vision pass. After ranking, the
        single <span className="text-foreground font-medium">Save (final)</span>{" "}
        cap keeps only the best N overall — source-independent.
      </p>

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

      <div className="mt-4">
        <TextAreaField
          label="Image analysis prompt"
          value={analysisPrompt}
          onChange={setAnalysisPrompt}
          disabled={savePending || !vision}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Analyze Google images" value={g} min={0} max={10} onChange={setG} disabled={savePending || !vision} />
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Analyze Website images" value={w} min={0} max={10} onChange={setW} disabled={savePending || !vision} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Analyze Instagram images" value={ig} min={0} max={20} onChange={setIg} disabled={savePending || !vision} />
      </div>

      <div className="mt-4">
        <TextAreaField
          label="Image sorting prompt"
          value={sortingPrompt}
          onChange={setSortingPrompt}
          disabled={savePending || !vision}
        />
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

      <SaveRow pending={savePending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </section>
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
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Analysis &amp; cost
        </h2>
      </div>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        The final synthesis model (Research Backbone) and the hard spend ceiling
        per venue.
      </p>

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
    </section>
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
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <DollarSign className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Per-venue cost estimate
        </h2>
      </div>

      {/* Params */}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Layers className="text-muted-foreground h-4 w-4" />
            Source tier ceiling
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((t) => (
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
          desc="When off, images are saved in source order with no AI vision/sort — the vision + sort lines drop out of the estimate."
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
        “Analysis and Cost” hard-stops spend regardless.
      </p>
    </section>
  );
}

function StageGroup({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-[0.14em] uppercase">
        {label}
      </h3>
      {desc && (
        <p className="text-muted-foreground/80 mb-4 max-w-3xl text-xs leading-relaxed">
          {desc}
        </p>
      )}
      {children}
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
