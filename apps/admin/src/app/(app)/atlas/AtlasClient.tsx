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
  MessageSquare,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import {
  setAtlasPreRead,
  snapshotAllVenues,
  updateAtlasConfig,
  type SynthesisQuality,
} from "./actions";

// Atlas source catalog. The key + tier define which sources the Sourcing
// stage attempts: a source runs when its tier <= the configured ceiling,
// unless an explicit per-source override flips it. Google Business is the
// spine and is always on.
//
// NOTE: when the enrich agent starts CONSUMING these params, it must mirror
// this same key→tier catalog server-side (it resolves effective-enabled from
// tier ceiling + overrides). Until then this is the config surface only.
const ATLAS_SOURCES: {
  key: string;
  label: string;
  tier: number;
  locked?: boolean;
}[] = [
  { key: "google_business", label: "Google Business", tier: 1, locked: true },
  { key: "website", label: "Website", tier: 1 },
  { key: "instagram", label: "Instagram", tier: 1 },
  { key: "mesita", label: "Mesita snapshot", tier: 1 },
  { key: "facebook", label: "Facebook", tier: 2 },
  { key: "serp", label: "SERP", tier: 2 },
  { key: "tripadvisor", label: "TripAdvisor", tier: 3 },
  { key: "yelp", label: "Yelp", tier: 3 },
  { key: "opentable", label: "OpenTable", tier: 4 },
  { key: "ubereats", label: "UberEats", tier: 4 },
  { key: "tiktok", label: "TikTok", tier: 5 },
  { key: "youtube", label: "YouTube", tier: 5 },
];

function sourceEnabled(
  src: { key: string; tier: number; locked?: boolean },
  ceiling: number,
  overrides: Record<string, boolean>,
): boolean {
  if (src.locked) return true;
  if (src.key in overrides) return overrides[src.key];
  return src.tier <= ceiling;
}

export function AtlasClient(props: {
  initialPreReadEnabled: boolean;
  initialSaveSnapshots: boolean;
  initialSnapshotOnBusinessEdit: boolean;
  initialGoogleImages: number;
  initialInstagramPosts: number;
  initialSourceTierCeiling: number;
  initialSourceOverrides: Record<string, boolean>;
  initialSerpOnlyWhenThin: boolean;
  initialGoogleReviews: number;
  initialWebsiteCrawlMaxPages: number;
  initialReviewsPerSite: number;
  initialImageVisionEnabled: boolean;
  initialMaxImagesAnalyzed: number;
  initialPerSourceAiSummary: boolean;
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

      {/* ═══ Snapshots & caching ═══════════════════════════════════ */}
      <StageGroup label="Snapshots & caching">
        <SnapshotToggles
          initialPreReadEnabled={props.initialPreReadEnabled}
          initialSaveSnapshots={props.initialSaveSnapshots}
          initialSnapshotOnBusinessEdit={props.initialSnapshotOnBusinessEdit}
          onSaved={setUpdatedAt}
        />
      </StageGroup>

      {/* ═══ Sourcing ══════════════════════════════════════════════ */}
      <StageGroup label="Sourcing — which sources run">
        <SourcesSection
          initialTierCeiling={props.initialSourceTierCeiling}
          initialOverrides={props.initialSourceOverrides}
          initialSerpOnlyWhenThin={props.initialSerpOnlyWhenThin}
          onSaved={setUpdatedAt}
        />
      </StageGroup>

      {/* ═══ Data depth ════════════════════════════════════════════ */}
      <StageGroup label="Data — how much to pull per source">
        <DataDepthSection
          initialGoogleImages={props.initialGoogleImages}
          initialInstagramPosts={props.initialInstagramPosts}
          initialGoogleReviews={props.initialGoogleReviews}
          initialWebsiteCrawlMaxPages={props.initialWebsiteCrawlMaxPages}
          initialReviewsPerSite={props.initialReviewsPerSite}
          onSaved={setUpdatedAt}
        />
      </StageGroup>

      {/* ═══ Analysis ══════════════════════════════════════════════ */}
      <StageGroup label="Analysis — AI & cost">
        <AnalysisSection
          initialImageVisionEnabled={props.initialImageVisionEnabled}
          initialMaxImagesAnalyzed={props.initialMaxImagesAnalyzed}
          initialPerSourceAiSummary={props.initialPerSourceAiSummary}
          initialSynthesisQuality={props.initialSynthesisQuality}
          initialPerRunCostCapUsd={props.initialPerRunCostCapUsd}
          onSaved={setUpdatedAt}
        />
      </StageGroup>

      {/* ═══ Profile backup ════════════════════════════════════════ */}
      <StageGroup label="Profile backup">
        <BackupSection />
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
  initialOverrides,
  initialSerpOnlyWhenThin,
  onSaved,
}: {
  initialTierCeiling: number;
  initialOverrides: Record<string, boolean>;
  initialSerpOnlyWhenThin: boolean;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [ceiling, setCeiling] = useState(initialTierCeiling);
  const [overrides, setOverrides] =
    useState<Record<string, boolean>>(initialOverrides);
  const [serpThin, setSerpThin] = useState(initialSerpOnlyWhenThin);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const persist = (
    patch: Parameters<typeof updateAtlasConfig>[0],
    rollback: () => void,
  ) => {
    setError(null);
    start(async () => {
      const r = await updateAtlasConfig(patch);
      if (!r.ok) {
        rollback();
        setError(r.error);
        return;
      }
      setCeiling(r.data.atlasSourceTierCeiling);
      setOverrides(r.data.atlasSourceOverrides ?? {});
      setSerpThin(r.data.atlasSerpOnlyWhenThin);
      onSaved(r.data.updatedAt);
    });
  };

  const changeCeiling = (next: number) => {
    const prev = ceiling;
    setCeiling(next);
    persist({ sourceTierCeiling: next }, () => setCeiling(prev));
  };

  const toggleSource = (src: (typeof ATLAS_SOURCES)[number]) => {
    if (src.locked) return;
    const prev = overrides;
    const nextOn = !sourceEnabled(src, ceiling, overrides);
    const next = { ...overrides, [src.key]: nextOn };
    setOverrides(next);
    persist({ sourceOverrides: next }, () => setOverrides(prev));
  };

  const flipSerp = () => {
    const prev = serpThin;
    const next = !serpThin;
    setSerpThin(next);
    persist({ serpOnlyWhenThin: next }, () => setSerpThin(prev));
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
        A source runs when its tier is at or above the ceiling. Use the toggles
        to override individual sources. Google Business is the spine and always
        runs.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Tier ceiling</label>
        <div className="flex items-center gap-1.5">
          <Layers className="text-muted-foreground h-4 w-4" />
          {[1, 2, 3, 4, 5].map((t) => (
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

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ATLAS_SOURCES.map((src) => {
          const on = sourceEnabled(src, ceiling, overrides);
          const overridden = !src.locked && src.key in overrides;
          return (
            <button
              key={src.key}
              type="button"
              onClick={() => toggleSource(src)}
              disabled={pending || src.locked}
              className={`border-border bg-background flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition disabled:cursor-default ${
                src.locked ? "opacity-70" : "hover:border-foreground/40"
              }`}
            >
              <span className="flex flex-col">
                <span className="text-sm font-medium">{src.label}</span>
                <span className="text-muted-foreground text-[11px]">
                  T{src.tier}
                  {src.locked ? " · spine" : overridden ? " · override" : ""}
                </span>
              </span>
              <span
                className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold tracking-wide uppercase ${
                  on
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {on ? "On" : "Off"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-border mt-5 flex items-center justify-between gap-4 border-t pt-5">
        <div className="flex items-center gap-2">
          <Search className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">SERP only when Google is thin</span>
        </div>
        <Switch
          on={serpThin}
          pending={pending}
          onClick={flipSerp}
          label="Toggle SERP only when thin"
        />
      </div>

      {error && <ErrorNote message={error} />}
    </section>
  );
}

// ─── Data depth ──────────────────────────────────────────────────────────

function DataDepthSection({
  initialGoogleImages,
  initialInstagramPosts,
  initialGoogleReviews,
  initialWebsiteCrawlMaxPages,
  initialReviewsPerSite,
  onSaved,
}: {
  initialGoogleImages: number;
  initialInstagramPosts: number;
  initialGoogleReviews: number;
  initialWebsiteCrawlMaxPages: number;
  initialReviewsPerSite: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [googleImages, setGoogleImages] = useState(initialGoogleImages);
  const [instagramPosts, setInstagramPosts] = useState(initialInstagramPosts);
  const [googleReviews, setGoogleReviews] = useState(initialGoogleReviews);
  const [websitePages, setWebsitePages] = useState(initialWebsiteCrawlMaxPages);
  const [reviewsPerSite, setReviewsPerSite] = useState(initialReviewsPerSite);
  const [saved, setSaved] = useState({
    googleImages: initialGoogleImages,
    instagramPosts: initialInstagramPosts,
    googleReviews: initialGoogleReviews,
    websitePages: initialWebsiteCrawlMaxPages,
    reviewsPerSite: initialReviewsPerSite,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty =
    googleImages !== saved.googleImages ||
    instagramPosts !== saved.instagramPosts ||
    googleReviews !== saved.googleReviews ||
    websitePages !== saved.websitePages ||
    reviewsPerSite !== saved.reviewsPerSite;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        googleImages,
        instagramPosts,
        googleReviews,
        websiteCrawlMaxPages: websitePages,
        reviewsPerSite,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        googleImages: r.data.atlasResearchGoogleImages,
        instagramPosts: r.data.atlasResearchInstagramPosts,
        googleReviews: r.data.atlasGoogleReviews,
        websitePages: r.data.atlasWebsiteCrawlMaxPages,
        reviewsPerSite: r.data.atlasReviewsPerSite,
      });
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Data depth
        </h2>
      </div>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        How much Atlas pulls from each source per research run.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Google images" value={googleImages} min={0} max={20} onChange={setGoogleImages} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram posts" value={instagramPosts} min={0} max={50} onChange={setInstagramPosts} disabled={pending} />
        <NumberField icon={<Star className="text-muted-foreground h-4 w-4" />} label="Google reviews" value={googleReviews} min={0} max={5} onChange={setGoogleReviews} disabled={pending} />
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Website pages (crawl)" value={websitePages} min={1} max={20} onChange={setWebsitePages} disabled={pending} />
        <NumberField icon={<MessageSquare className="text-muted-foreground h-4 w-4" />} label="Reviews per site" value={reviewsPerSite} min={0} max={30} onChange={setReviewsPerSite} disabled={pending} />
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </section>
  );
}

// ─── Analysis ────────────────────────────────────────────────────────────

const QUALITY_OPTIONS: { value: SynthesisQuality; label: string; hint: string }[] = [
  { value: "economy", label: "Economy", hint: "gpt-4o-mini" },
  { value: "standard", label: "Standard", hint: "gpt-4o" },
  { value: "high", label: "High", hint: "GPT-5.x" },
];

function AnalysisSection({
  initialImageVisionEnabled,
  initialMaxImagesAnalyzed,
  initialPerSourceAiSummary,
  initialSynthesisQuality,
  initialPerRunCostCapUsd,
  onSaved,
}: {
  initialImageVisionEnabled: boolean;
  initialMaxImagesAnalyzed: number;
  initialPerSourceAiSummary: boolean;
  initialSynthesisQuality: SynthesisQuality;
  initialPerRunCostCapUsd: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [vision, setVision] = useState(initialImageVisionEnabled);
  const [perSource, setPerSource] = useState(initialPerSourceAiSummary);
  const [maxImages, setMaxImages] = useState(initialMaxImagesAnalyzed);
  const [quality, setQuality] = useState<SynthesisQuality>(initialSynthesisQuality);
  const [costCap, setCostCap] = useState(initialPerRunCostCapUsd);
  const [saved, setSaved] = useState({
    maxImages: initialMaxImagesAnalyzed,
    quality: initialSynthesisQuality,
    costCap: initialPerRunCostCapUsd,
  });
  const [togglePending, startToggle] = useTransition();
  const [savePending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty =
    maxImages !== saved.maxImages ||
    quality !== saved.quality ||
    costCap !== saved.costCap;

  const flip = (
    key: "imageVisionEnabled" | "perSourceAiSummary",
    cur: boolean,
    setLocal: (v: boolean) => void,
  ) => {
    setError(null);
    const next = !cur;
    setLocal(next);
    startToggle(async () => {
      const r = await updateAtlasConfig({ [key]: next });
      if (!r.ok) {
        setLocal(!next);
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
        maxImagesAnalyzed: maxImages,
        synthesisQuality: quality,
        perRunCostCapUsd: costCap,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        maxImages: r.data.atlasMaxImagesAnalyzed,
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
          Analysis
        </h2>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Eye className="text-muted-foreground h-4 w-4" />
            Image vision
            <span className="text-muted-foreground text-[11px]">(the cost driver)</span>
          </span>
          <Switch
            on={vision}
            pending={togglePending}
            onClick={() => flip("imageVisionEnabled", vision, setVision)}
            label="Toggle image vision"
          />
        </div>
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="text-muted-foreground h-4 w-4" />
            Per-source AI summary
          </span>
          <Switch
            on={perSource}
            pending={togglePending}
            onClick={() => flip("perSourceAiSummary", perSource, setPerSource)}
            label="Toggle per-source AI summary"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField
          icon={<ImageIcon className="text-muted-foreground h-4 w-4" />}
          label="Max images analyzed"
          value={maxImages}
          min={0}
          max={100}
          onChange={setMaxImages}
          disabled={savePending || !vision}
        />
        <NumberField
          icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
          label="Cost cap (USD / venue)"
          value={costCap}
          min={0}
          max={50}
          decimals
          onChange={setCostCap}
          disabled={savePending}
        />
        <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="text-muted-foreground h-4 w-4" />
            Synthesis quality
          </span>
          <select
            value={quality}
            disabled={savePending}
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
      </div>

      <SaveRow pending={savePending} dirty={dirty} ok={ok} onClick={save} />
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
