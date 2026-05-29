"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Archive,
  Camera,
  CheckCircle2,
  DollarSign,
  Eye,
  Globe,
  History,
  Image as ImageIcon,
  Instagram,
  Layers,
  Loader2,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  setAtlasPreRead,
  snapshotAllVenues,
  updateAtlasConfig,
  type SynthesisQuality,
} from "./actions";

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
  initialPreReadEnabled: boolean;
  initialSaveSnapshots: boolean;
  initialSnapshotOnBusinessEdit: boolean;
  initialSourceTierCeiling: number;
  initialSourceOverrides: Record<string, boolean>;
  initialWebsiteCrawlMaxPages: number;
  initialInstagramPosts: number;
  initialImageVisionEnabled: boolean;
  initialSaveGoogleImages: number;
  initialSaveWebsiteImages: number;
  initialSaveInstagramImages: number;
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

      {/* ═══ Pipeline & snapshots ══════════════════════════════════ */}
      <StageGroup label="Pipeline & snapshots">
        <div className="flex flex-col gap-6">
          <SnapshotToggles
            initialPreReadEnabled={props.initialPreReadEnabled}
            initialSaveSnapshots={props.initialSaveSnapshots}
            initialSnapshotOnBusinessEdit={props.initialSnapshotOnBusinessEdit}
            onSaved={setUpdatedAt}
          />
          <BackupSection />
        </div>
      </StageGroup>

      {/* ═══ Data sources ══════════════════════════════════════════ */}
      <StageGroup label="Data sources">
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

      {/* ═══ Pre-selection (save) ══════════════════════════════════ */}
      <StageGroup label="Pre-selection — images saved per source">
        <PreSelectionSection
          initialSaveGoogleImages={props.initialSaveGoogleImages}
          initialSaveWebsiteImages={props.initialSaveWebsiteImages}
          initialSaveInstagramImages={props.initialSaveInstagramImages}
          initialInstagramPosts={props.initialInstagramPosts}
          onSaved={setUpdatedAt}
        />
      </StageGroup>

      {/* ═══ Vision Params (analyze) ═══════════════════════════════ */}
      <StageGroup label="Vision Params">
        <VisionParamsSection
          initialImageVisionEnabled={props.initialImageVisionEnabled}
          initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
          initialAnalyzeWebsiteImages={props.initialAnalyzeWebsiteImages}
          initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
          initialImageAnalysisPrompt={props.initialImageAnalysisPrompt}
          initialImageSortingPrompt={props.initialImageSortingPrompt}
          onSaved={setUpdatedAt}
        />
      </StageGroup>

      {/* ═══ Analysis and Cost ═════════════════════════════════════ */}
      <StageGroup label="Analysis and Cost">
        <SynthCostSection
          initialSynthesisQuality={props.initialSynthesisQuality}
          initialPerRunCostCapUsd={props.initialPerRunCostCapUsd}
          onSaved={setUpdatedAt}
        />
      </StageGroup>
    </div>
  );
}

// ─── Snapshots & caching ─────────────────────────────────────────────────

function SnapshotToggles({
  initialPreReadEnabled,
  initialSaveSnapshots,
  initialSnapshotOnBusinessEdit,
  onSaved,
}: {
  initialPreReadEnabled: boolean;
  initialSaveSnapshots: boolean;
  initialSnapshotOnBusinessEdit: boolean;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [preRead, setPreRead] = useState(initialPreReadEnabled);
  const [save, setSave] = useState(initialSaveSnapshots);
  const [onEdit, setOnEdit] = useState(initialSnapshotOnBusinessEdit);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const flipPreRead = () => {
    setError(null);
    const next = !preRead;
    setPreRead(next);
    start(async () => {
      const r = await setAtlasPreRead(next);
      if (!r.ok) {
        setPreRead(!next);
        setError(r.error);
        return;
      }
      setPreRead(r.data.atlasPreReadSnapshots);
      onSaved(r.data.updatedAt);
    });
  };

  const flip = (
    key: "saveSnapshots" | "snapshotOnBusinessEdit",
    cur: boolean,
    setLocal: (v: boolean) => void,
    read: (d: {
      atlasSaveSnapshots: boolean;
      atlasSnapshotOnBusinessEdit: boolean;
    }) => boolean,
  ) => {
    setError(null);
    const next = !cur;
    setLocal(next);
    start(async () => {
      const r = await updateAtlasConfig({ [key]: next });
      if (!r.ok) {
        setLocal(!next);
        setError(r.error);
        return;
      }
      setLocal(read(r.data));
      onSaved(r.data.updatedAt);
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card
        icon={<Search className="text-muted-foreground h-4 w-4" />}
        title="Reuse past research snapshots before fetching"
        desc="When ON, Atlas reads the research it saved for this venue before calling any external API, and only fetches what's missing. When OFF, every run fetches from scratch."
        control={
          <Switch on={preRead} pending={pending} onClick={flipPreRead} label="Toggle pre-read" />
        }
      />
      <Card
        icon={<Archive className="text-muted-foreground h-4 w-4" />}
        title="Save research snapshot from every run"
        desc="When ON, each run's research is saved to Storage as append-only history, so pre-read can reuse it. When OFF, research is used once and not persisted."
        control={
          <Switch
            on={save}
            pending={pending}
            onClick={() =>
              flip("saveSnapshots", save, setSave, (d) => d.atlasSaveSnapshots)
            }
            label="Toggle save research"
          />
        }
      />
      <Card
        className="md:col-span-2"
        icon={<History className="text-muted-foreground h-4 w-4" />}
        title="Save a profile snapshot on every business edit"
        desc="When ON, Atlas saves a profile snapshot every time a business user updates their venue — an edit history of the canonical profile. Automatic + per-venue; the manual bulk back-up below is separate."
        control={
          <Switch
            on={onEdit}
            pending={pending}
            onClick={() =>
              flip(
                "snapshotOnBusinessEdit",
                onEdit,
                setOnEdit,
                (d) => d.atlasSnapshotOnBusinessEdit,
              )
            }
            label="Toggle snapshot on business edit"
          />
        }
      />
      {error && (
        <div className="md:col-span-2">
          <ErrorNote message={error} />
        </div>
      )}
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

// ─── Pre-selection (images saved per source) ───────────────────────────────

function PreSelectionSection({
  initialSaveGoogleImages,
  initialSaveWebsiteImages,
  initialSaveInstagramImages,
  initialInstagramPosts,
  onSaved,
}: {
  initialSaveGoogleImages: number;
  initialSaveWebsiteImages: number;
  initialSaveInstagramImages: number;
  initialInstagramPosts: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [g, setG] = useState(initialSaveGoogleImages);
  const [w, setW] = useState(initialSaveWebsiteImages);
  const [ig, setIg] = useState(initialSaveInstagramImages);
  const [posts, setPosts] = useState(initialInstagramPosts);
  const [saved, setSaved] = useState({
    g: initialSaveGoogleImages,
    w: initialSaveWebsiteImages,
    ig: initialSaveInstagramImages,
    posts: initialInstagramPosts,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty =
    g !== saved.g || w !== saved.w || ig !== saved.ig || posts !== saved.posts;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        saveGoogleImages: g,
        saveWebsiteImages: w,
        saveInstagramImages: ig,
        instagramPosts: posts,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        g: r.data.atlasSaveGoogleImages,
        w: r.data.atlasSaveWebsiteImages,
        ig: r.data.atlasSaveInstagramImages,
        posts: r.data.atlasResearchInstagramPosts,
      });
      setG(r.data.atlasSaveGoogleImages);
      setW(r.data.atlasSaveWebsiteImages);
      setIg(r.data.atlasSaveInstagramImages);
      setPosts(r.data.atlasResearchInstagramPosts);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <ImageIcon className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Pre-selection
        </h2>
      </div>
      <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
        How many images we pull &amp; SAVE to the venue per source. Google = Places
        default order; Website = ranked by image size; Instagram = scrape{" "}
        <span className="text-foreground font-medium">Instagram posts per profile</span>{" "}
        as a candidate <span className="text-foreground font-medium">pool</span>, extract
        their photos (images only, no video), rank by likes, and keep the top{" "}
        <span className="text-foreground font-medium">Save Instagram images</span>.
        So posts ≠ images: <span className="text-foreground font-medium">posts</span> = how
        deep we scrape (the pool), <span className="text-foreground font-medium">images</span> ={" "}
        how many we keep. The pool should be bigger than what you keep so the
        like-ranking has something to choose from.{" "}
        This is NOT how many get analyzed — that&apos;s Vision Params. Ceiling 50
        images/venue.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Save Google images" value={g} min={0} max={10} onChange={setG} disabled={pending} />
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Save Website images" value={w} min={0} max={10} onChange={setW} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Save Instagram images" value={ig} min={0} max={30} onChange={setIg} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram posts per profile" value={posts} min={0} max={50} onChange={setPosts} disabled={pending} />
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
  initialImageAnalysisPrompt,
  initialImageSortingPrompt,
  onSaved,
}: {
  initialImageVisionEnabled: boolean;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeWebsiteImages: number;
  initialAnalyzeInstagramImages: number;
  initialImageAnalysisPrompt: string;
  initialImageSortingPrompt: string;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [vision, setVision] = useState(initialImageVisionEnabled);
  const [g, setG] = useState(initialAnalyzeGoogleImages);
  const [w, setW] = useState(initialAnalyzeWebsiteImages);
  const [ig, setIg] = useState(initialAnalyzeInstagramImages);
  const [analysisPrompt, setAnalysisPrompt] = useState(initialImageAnalysisPrompt);
  const [sortingPrompt, setSortingPrompt] = useState(initialImageSortingPrompt);
  const [saved, setSaved] = useState({
    g: initialAnalyzeGoogleImages,
    w: initialAnalyzeWebsiteImages,
    ig: initialAnalyzeInstagramImages,
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
        analysisPrompt: r.data.atlasImageAnalysisPrompt,
        sortingPrompt: r.data.atlasImageSortingPrompt,
      });
      setG(r.data.atlasAnalyzeGoogleImages);
      setW(r.data.atlasAnalyzeWebsiteImages);
      setIg(r.data.atlasAnalyzeInstagramImages);
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
        Vision describes each image (analysis prompt), then ranks them
        best→worst (sorting prompt). These caps bound how many of the SAVED
        images get analyzed per source — usually fewer than saved, since vision
        is the expensive step.
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

// ─── Profile backup (manual bulk) ────────────────────────────────────────

function BackupSection() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ written: number; failed: number } | null>(
    null,
  );

  const run = () => {
    setError(null);
    setResult(null);
    start(async () => {
      const r = await snapshotAllVenues();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult({ written: r.data.snapshotsWritten, failed: r.data.snapshotsFailed });
    });
  };

  return (
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Camera className="text-muted-foreground h-4 w-4" />
            <h2 className="font-display text-base font-semibold tracking-tight">
              Back up venue profiles now
            </h2>
          </div>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Writes a backup of every venue&apos;s{" "}
            <span className="text-foreground font-medium">finished profile</span>{" "}
            (the canonical{" "}
            <code className="text-foreground bg-muted rounded px-1 text-[11px]">
              public.venues
            </code>{" "}
            state) to Storage. This is the output, not the research inputs above.
            Routine backups will run nightly via cron (future PR).
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="bg-foreground text-background inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Backing up…
            </>
          ) : (
            <>
              <Camera className="h-3.5 w-3.5" />
              Back up all
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="border-foreground/20 bg-muted text-foreground mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="font-medium">
            {result.written} snapshot{result.written === 1 ? "" : "s"} written
            {result.failed > 0 ? `, ${result.failed} failed` : ""}.
          </p>
        </div>
      )}
      {error && <ErrorNote message={error} />}
    </section>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────

function StageGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.14em] uppercase">
        {label}
      </h3>
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
