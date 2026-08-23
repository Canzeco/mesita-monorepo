"use client";

import { useState, useTransition } from "react";
import {
  Brain,
  CalendarClock,
  CheckCheck,
  Database,
  DollarSign,
  Eye,
  Facebook,
  Globe,
  Image as ImageIcon,
  Images,
  Instagram,
  Link2,
  ListChecks,
  Lock,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import { updateAtlasConfig, type PerplexityPreset, type SynthesisQuality } from "./actions";
import { ErrorNote } from "@/components/ErrorNote";
import {
  Collapsible,
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
  TextAreaField,
} from "./atlas-ui";

// ─── Image funnel (Collection → Analysis → Selection) ───────────────────────
// Two stacked stages with a hard PER-SOURCE lock: every downstream count is
// bounded by its OWN source upstream, not by a shared sum. You can't analyze
// more of a source than you collected, or save more than you analyzed:
//   Google/IG analyze ≤ that source's collect · save ≤ analyzed
// Collection is just the candidate pool per source (Google in Google order,
// Instagram pre-sorted by likes). Analysis is the real selector: it takes the
// first N of each pool, so "analyze N" implicitly IS "keep N" — there's no
// separate keep knob. The lock is enforced live by clamping downstream values
// whenever an upstream one drops, and by capping each input's max against its
// own source — so an invalid config (e.g. analyze 15 IG when only 10 were
// collected) can never be entered, let alone saved.

type Funnel = { gg: number; depth: number; ag: number; ai: number; save: number };

// Shared with the NumberField bounds below — keep both in sync so the clamp
// and the input's max never disagree about the funnel's invariant.
const MAX_GOOGLE_COLLECT = 10;
// 30, because that is what the DB CHECK enforces
// (app_config_atlas_gather_instagram_depth_range). This was 50, so the field
// offered 31-50 — values that passed here and passed the EF and were then
// rejected at the write (MESITA-1195).
const MAX_INSTAGRAM_COLLECT = 30;
// Matches DB CHECK app_config_atlas_save_total_images_range (0–10) and the
// admin-web-update-enricher-config / ENRICH_FIELD_LIMITS.photos contract. UI min
// stays 1 (a zero-save gallery is not useful from this knob). Separate from
// PHOTO_CEILING=50 in enrich-config.ts (S9 storage-mirror hard cap).
const MAX_SAVE_IMAGES = 10;

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

// Enforce the per-source chain, reducing downstream values to fit:
//   Google analyze ≤ Google collect · IG analyze ≤ IG collect ·
//   save ≤ (Google analyze + IG analyze), capped at MAX_SAVE_IMAGES.
function normalizeFunnel(s: Funnel): Funnel {
  const gg = clampN(s.gg, 1, MAX_GOOGLE_COLLECT); // Google collect
  const depth = clampN(s.depth, 1, MAX_INSTAGRAM_COLLECT); // Instagram collect (downloaded, sorted by likes)
  const ag = clampN(s.ag, 1, gg); // Google analyze ≤ Google collect
  const ai = clampN(s.ai, 1, depth); // Instagram analyze ≤ Instagram collect
  const save = clampN(s.save, 1, Math.min(MAX_SAVE_IMAGES, ag + ai)); // Selection ≤ analyzed
  return { gg, depth, ag, ai, save };
}

function StageTotal({ label, n }: { label: string; n: number }) {
  return (
    <span className="border-border bg-background inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums">
      <span className="text-muted-foreground font-medium">{label}</span>
      {n}
    </span>
  );
}

function SubHeading({
  icon,
  title,
  hint,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  status?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
        {hint && <span className="text-muted-foreground type-label font-normal">{hint}</span>}
      </span>
      {status}
    </div>
  );
}

// One "Images" box: the whole photo funnel (Collection → Analysis → Selection)
// as three subsections in a single card, plus two binaries.
//
// Vision is a REAL kill-switch (app_config.atlas_image_vision_enabled): the
// analysis stage reads it and skips the whole describe+rank pass when it's off
// (supabase-cron-enrich-place-analysis). Off does NOT mean "no photos" — the
// funnel still collects and still keeps saveTotalImages, just in source order
// (Google relevance, then Instagram likes) with no quality ranking and no image
// descriptions. So the analyze counts only drive anything while vision is on,
// and this box disables them when it isn't rather than asserting they're live.
//
// The per-source lock still holds (analyze ≤ collect, keep ≤ analyzed total);
// the numeric knobs batch under one Save, and both binaries — Vision and
// Storage — save on the spot like feature switches.
export function ImageFunnelSection({
  initialGatherGoogleImages,
  initialGatherInstagramDepth,
  initialAnalyzeGoogleImages,
  initialAnalyzeInstagramImages,
  initialSaveTotalImages,
  initialImageVisionEnabled,
  initialSaveImagesToStorage,
  initialImageAnalysisPrompt,
  initialImageSortingPrompt,
  onSaved,
}: {
  initialGatherGoogleImages: number;
  initialGatherInstagramDepth: number;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
  initialSaveTotalImages: number;
  initialImageVisionEnabled: boolean;
  initialSaveImagesToStorage: boolean;
  initialImageAnalysisPrompt: string;
  initialImageSortingPrompt: string;
  onSaved: (updatedAt: string | null) => void;
}) {
  const init = normalizeFunnel({
    gg: initialGatherGoogleImages,
    depth: initialGatherInstagramDepth,
    ag: initialAnalyzeGoogleImages,
    ai: initialAnalyzeInstagramImages,
    save: initialSaveTotalImages,
  });
  const [f, setF] = useState<Funnel>(init);
  const [analysisPrompt, setAnalysisPrompt] = useState(initialImageAnalysisPrompt);
  const [sortingPrompt, setSortingPrompt] = useState(initialImageSortingPrompt);
  const [vision, setVision] = useState(initialImageVisionEnabled);
  const [storage, setStorage] = useState(initialSaveImagesToStorage);
  const [saved, setSaved] = useState({
    ...init,
    analysisPrompt: initialImageAnalysisPrompt,
    sortingPrompt: initialImageSortingPrompt,
  });
  const [savePending, startSave] = useTransition();
  const [visionPending, startVision] = useTransition();
  const [storagePending, startStorage] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Every edit re-normalizes the whole funnel, so the lock holds at all times.
  const patch = (p: Partial<Funnel>) => {
    setOk(false);
    setF((cur) => normalizeFunnel({ ...cur, ...p }));
  };

  const cSum = f.gg + f.depth;
  const aSum = f.ag + f.ai;

  const dirty =
    f.gg !== saved.gg ||
    f.depth !== saved.depth ||
    f.ag !== saved.ag ||
    f.ai !== saved.ai ||
    f.save !== saved.save ||
    analysisPrompt !== saved.analysisPrompt ||
    sortingPrompt !== saved.sortingPrompt;

  // Vision is a feature switch, not a numeric knob — persist it on the spot and
  // roll the optimistic flip back if the EF rejects it. Nothing else in this box
  // is re-fetched: the analyze counts keep their values while vision is off so
  // turning it back on restores the operator's caps unchanged.
  const flipVision = () => {
    setError(null);
    const next = !vision;
    setVision(next);
    startVision(async () => {
      const r = await updateAtlasConfig({ imageVisionEnabled: next });
      if (!r.ok) {
        setVision(!next);
        setError(r.error);
        return;
      }
      onSaved(r.data.updatedAt);
    });
  };

  // Storage mirroring is a feature switch — persist it on the spot.
  const flipStorage = () => {
    setError(null);
    const next = !storage;
    setStorage(next);
    startStorage(async () => {
      const r = await updateAtlasConfig({ saveImagesToStorage: next });
      if (!r.ok) {
        setStorage(!next);
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
        gatherGoogleImages: f.gg,
        gatherInstagramDepth: f.depth,
        // No separate "keep" knob: the full likes-sorted window IS the pool, and
        // Analysis takes the first N. Keep posts == depth so nothing is dropped
        // before ranking.
        gatherInstagramPosts: f.depth,
        analyzeGoogleImages: f.ag,
        analyzeInstagramImages: f.ai,
        saveTotalImages: f.save,
        imageAnalysisPrompt: analysisPrompt,
        imageSortingPrompt: sortingPrompt,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const nf = normalizeFunnel({
        gg: r.data.atlasGatherGoogleImages,
        depth: r.data.atlasGatherInstagramDepth,
        ag: r.data.atlasAnalyzeGoogleImages,
        ai: r.data.atlasAnalyzeInstagramImages,
        save: r.data.atlasSaveTotalImages,
      });
      setF(nf);
      setAnalysisPrompt(r.data.atlasImageAnalysisPrompt);
      setSortingPrompt(r.data.atlasImageSortingPrompt);
      setSaved({
        ...nf,
        analysisPrompt: r.data.atlasImageAnalysisPrompt,
        sortingPrompt: r.data.atlasImageSortingPrompt,
      });
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<Images className="text-muted-foreground h-4 w-4" />}
      title="5–6 · Social & Images"
      subtitle="Two steps, one box. Social (5) downloads the Instagram pool; Images (6) describes it with vision, ranks it, and picks the gallery. The knobs live together because the chain is validated as one thing — collect ≥ analyze ≥ save — and splitting it would let you save an analyze cap higher than the collect depth that feeds it."
    >
      {/* ── Collection ── */}
      <div className="border-border mt-6 border-t pt-6">
        <SubHeading
          icon={<Images className="text-muted-foreground h-4 w-4" />}
          title="Collection"
          hint="candidate pool per source"
          status={<StageTotal label="collected" n={cSum} />}
        />
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Google collect" value={f.gg} min={1} max={MAX_GOOGLE_COLLECT} onChange={(v) => patch({ gg: v })} disabled={savePending} />
          <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram collect" value={f.depth} min={1} max={MAX_INSTAGRAM_COLLECT} onChange={(v) => patch({ depth: v })} disabled={savePending} />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Google returns its photos already ranked by relevance — best first, so we take them in order. Instagram returns the <em>most recent</em> posts, so the Enricher re-ranks that window by number of likes. Analysis reads the top of each pool.
        </p>
      </div>

      {/* ── Analysis ── */}
      <div className="border-border mt-6 border-t pt-6">
        <SubHeading
          icon={<Eye className="text-muted-foreground h-4 w-4" />}
          title="Analysis"
          hint={vision ? "on · largest cost driver" : "off · no vision spend"}
          status={<StageTotal label="analyzed" n={vision ? aSum : 0} />}
        />

        <div className="border-border bg-background mt-3 flex flex-col gap-3 rounded-xl border p-4 xl:flex-row xl:items-center xl:justify-between">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Eye className="text-muted-foreground h-4 w-4" />
            Analyze images with the vision model
            <span className="text-muted-foreground type-label">off = keep photos in source order, unranked</span>
          </span>
          <Switch on={vision} pending={visionPending} onClick={flipVision} label="Toggle image vision" />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Analyze Google images (≤ Google collect)" value={f.ag} min={1} max={f.gg} onChange={(v) => patch({ ag: v })} disabled={savePending || !vision} />
          <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Analyze Instagram images (≤ Instagram collect)" value={f.ai} min={1} max={f.depth} onChange={(v) => patch({ ai: v })} disabled={savePending || !vision} />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {vision ? (
            <>
              The vision model describes the first N of each pool — Google&apos;s most-relevant and Instagram&apos;s most-liked — then re-ranks all of them by photo quality. Selection below keeps the best <span className="text-foreground font-semibold tabular-nums">{f.save}</span> of the <span className="text-foreground font-semibold tabular-nums">{aSum}</span> analyzed.
            </>
          ) : (
            <>
              Vision is off, so nothing is described or re-ranked and the counts above drive nothing — they keep their values for when you turn it back on. Photos are still collected and still saved: the top <span className="text-foreground font-semibold tabular-nums">{f.save}</span> in source order (Google by relevance, Instagram by likes), just without a quality ranking.
            </>
          )}
        </p>

        <Collapsible summary="Edit photo analysis prompts">
          <div className="space-y-4">
            {!vision && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                These prompts are saved but unused while vision is off.
              </p>
            )}
            <TextAreaField label="Image analysis prompt" value={analysisPrompt} onChange={(v) => { setOk(false); setAnalysisPrompt(v); }} disabled={savePending} />
            <TextAreaField label="Image sorting prompt" value={sortingPrompt} onChange={(v) => { setOk(false); setSortingPrompt(v); }} disabled={savePending} />
          </div>
        </Collapsible>
      </div>

      {/* ── Selection ── */}
      <div className="border-border mt-6 border-t pt-6">
        <SubHeading
          icon={<CheckCheck className="text-muted-foreground h-4 w-4" />}
          title="Selection"
          hint="final gallery on the profile"
          status={<StageTotal label="kept" n={f.save} />}
        />
        <div className="mt-3">
          <NumberField
            icon={<CheckCheck className="text-muted-foreground h-4 w-4" />}
            label="Photos to keep on profile (all sources combined)"
            value={f.save}
            min={1}
            max={Math.min(MAX_SAVE_IMAGES, aSum)}
            onChange={(v) => patch({ save: v })}
            disabled={savePending}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {vision ? (
            <>
              After ranking, the top <span className="text-foreground font-semibold tabular-nums">{f.save}</span> across all sources are saved to the profile — capped at the analysis total (<span className="tabular-nums">{aSum}</span>), up to {MAX_SAVE_IMAGES}.
            </>
          ) : (
            <>
              The first <span className="text-foreground font-semibold tabular-nums">{f.save}</span> across all sources are saved to the profile in source order. The ceiling still follows the analyze caps (<span className="tabular-nums">{aSum}</span>) so the number survives turning vision back on.
            </>
          )}{" "}
          Storage mirror uses a separate pipeline constant (<span className="font-mono">PHOTO_CEILING</span>=50), not this knob.
        </p>
      </div>

      {/* ── Storage binary ── */}
      <div className="border-border mt-6 border-t pt-6">
        <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4 xl:flex-row xl:items-center xl:justify-between">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Database className="text-muted-foreground h-4 w-4" />
            Save selected images to Supabase Storage
            <span className="text-muted-foreground type-label">off = render from source URLs</span>
          </span>
          <Switch on={storage} pending={storagePending} onClick={flipStorage} label="Toggle image storage" />
        </div>
      </div>

      {/* ── Funnel invariant + one save for the numeric knobs ── */}
      <div className="border-border mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium tabular-nums">
          <span className="text-muted-foreground">Funnel</span>{" "}
          Collect <span className="font-semibold">{cSum}</span>
          <span className="text-muted-foreground"> ≥ </span>
          {vision && (
            <>
              Analyze <span className="font-semibold">{aSum}</span>
              <span className="text-muted-foreground"> ≥ </span>
            </>
          )}
          Keep <span className="font-semibold">{f.save}</span>
          {!vision && (
            <span className="text-muted-foreground font-normal"> · unranked</span>
          )}
        </p>
        <SaveRow pending={savePending} dirty={dirty} ok={ok} onClick={save} />
      </div>
      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

// ─── Discovery (per-source Firecrawl Search candidate counts) ───────────────
// How many Firecrawl Search results to pull per source when hunting for a
// place's official links. Agent Y then reviews these candidates and picks one
// (or none) per field. 0 disables a source's search entirely.

const MAX_DISCOVERY_CANDIDATES = 10;

export function DiscoverySection({
  initialWebsiteN,
  initialInstagramN,
  initialFacebookN,
  initialOpentableN,
  initialUbereatsN,
  onSaved,
}: {
  initialWebsiteN: number;
  initialInstagramN: number;
  initialFacebookN: number;
  initialOpentableN: number;
  initialUbereatsN: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [website, setWebsite] = useState(initialWebsiteN);
  const [instagram, setInstagram] = useState(initialInstagramN);
  const [facebook, setFacebook] = useState(initialFacebookN);
  const [opentable, setOpentable] = useState(initialOpentableN);
  const [ubereats, setUbereats] = useState(initialUbereatsN);
  const [saved, setSaved] = useState({
    website: initialWebsiteN,
    instagram: initialInstagramN,
    facebook: initialFacebookN,
    opentable: initialOpentableN,
    ubereats: initialUbereatsN,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty =
    website !== saved.website ||
    instagram !== saved.instagram ||
    facebook !== saved.facebook ||
    opentable !== saved.opentable ||
    ubereats !== saved.ubereats;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        discoverWebsiteN: website,
        discoverInstagramN: instagram,
        discoverFacebookN: facebook,
        discoverOpentableN: opentable,
        discoverUbereatsN: ubereats,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        website: r.data.atlasDiscoverWebsiteN,
        instagram: r.data.atlasDiscoverInstagramN,
        facebook: r.data.atlasDiscoverFacebookN,
        opentable: r.data.atlasDiscoverOpentableN,
        ubereats: r.data.atlasDiscoverUbereatsN,
      });
      setWebsite(r.data.atlasDiscoverWebsiteN);
      setInstagram(r.data.atlasDiscoverInstagramN);
      setFacebook(r.data.atlasDiscoverFacebookN);
      setOpentable(r.data.atlasDiscoverOpentableN);
      setUbereats(r.data.atlasDiscoverUbereatsN);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<Link2 className="text-muted-foreground h-4 w-4" />}
      title="4 · Links"
      subtitle="How many Firecrawl Search candidates to pull per source (0–10) when finding a place's official links. Agent Y reviews these against the function-3 SERP Summary and picks the best one per field, or none. 0 turns a source off."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Website" value={website} min={0} max={MAX_DISCOVERY_CANDIDATES} onChange={setWebsite} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram" value={instagram} min={0} max={MAX_DISCOVERY_CANDIDATES} onChange={setInstagram} disabled={pending} />
        <NumberField icon={<Facebook className="text-muted-foreground h-4 w-4" />} label="Facebook" value={facebook} min={0} max={MAX_DISCOVERY_CANDIDATES} onChange={setFacebook} disabled={pending} />
        <NumberField icon={<CalendarClock className="text-muted-foreground h-4 w-4" />} label="OpenTable" value={opentable} min={0} max={MAX_DISCOVERY_CANDIDATES} onChange={setOpentable} disabled={pending} />
        <NumberField icon={<ShoppingBag className="text-muted-foreground h-4 w-4" />} label="Uber Eats" value={ubereats} min={0} max={MAX_DISCOVERY_CANDIDATES} onChange={setUbereats} disabled={pending} />
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

// ─── Reviews (how many Google reviews the Apify scrape pulls) ───────────────

export function ReviewsSection({
  initialGatherReviews,
  onSaved,
}: {
  initialGatherReviews: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [reviews, setReviews] = useState(initialGatherReviews);
  const [saved, setSaved] = useState(initialGatherReviews);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = reviews !== saved;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({ gatherReviews: reviews });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved(r.data.atlasGatherReviews);
      setReviews(r.data.atlasGatherReviews);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<Star className="text-muted-foreground h-4 w-4" />}
      title="8 · Reviews"
      subtitle="How many Google reviews Apify scrapes for the Enricher (0–100). Google Places itself only returns ~5; 100 is Mesita's hard safety bound for Edge Function wall-clock and Apify cost (~$0.50 per 100), not a Google limit. More reviews ground a richer Profile Description at function 9, but slow and price the scrape."
    >
      <div className="mt-5 sm:max-w-xs">
        <NumberField
          icon={<Star className="text-muted-foreground h-4 w-4" />}
          label="Google reviews to pull"
          value={reviews}
          min={0}
          max={100}
          onChange={setReviews}
          disabled={pending}
        />
      </div>
      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

// High maps to the same model as Standard in enrich-config.ts QUALITY_MODEL
// (gpt-4o) — kept as a stored enum value so existing rows don't break, but the
// UI must say it's identical / a no-op tier (not a third capability level).
const QUALITY_OPTIONS: { value: SynthesisQuality; label: string; hint: string }[] = [
  { value: "economy", label: "Economy", hint: "gpt-4o-mini" },
  { value: "standard", label: "Standard", hint: "gpt-4o" },
  { value: "high", label: "High", hint: "same as Standard · gpt-4o (no-op)" },
];

// Perplexity Agent presets — the "search model" for S2 (SERP) + S3 (links).
// Cost/depth climbs down the list; pro-search is the default.
const PERPLEXITY_OPTIONS: { value: PerplexityPreset; label: string; hint: string }[] = [
  { value: "fast-search", label: "Fast", hint: "1 step · cheapest" },
  { value: "pro-search", label: "Pro", hint: "5 steps · default" },
  { value: "deep-research", label: "Deep", hint: "10 steps · pricey" },
  { value: "advanced-deep-research", label: "Advanced", hint: "15 steps · priciest" },
];

// ─── Models (text / vision / search knobs + locked embeddings) ──────────────
// Embeddings are display-only on purpose: swapping the model changes vector
// dims and forces a full catalog re-embed. Text / Image / Search stay knobs.

const EMBEDDINGS_MODEL_LABEL = "OpenAI · text-embedding-3-small";
const EMBEDDINGS_MODEL_DETAIL = "1536-d · place ↔ intent · locked";

export function ModelsSection({
  initialSynthesisQuality,
  initialVisionQuality,
  initialPerplexityPreset,
  initialPerRunCostCapUsd,
  onSaved,
}: {
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialPerplexityPreset: PerplexityPreset;
  initialPerRunCostCapUsd: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [text, setText] = useState<SynthesisQuality>(initialSynthesisQuality);
  const [image, setImage] = useState<SynthesisQuality>(initialVisionQuality);
  const [search, setSearch] = useState<PerplexityPreset>(initialPerplexityPreset);
  const [costCap, setCostCap] = useState(initialPerRunCostCapUsd);
  const [saved, setSaved] = useState({
    text: initialSynthesisQuality,
    image: initialVisionQuality,
    search: initialPerplexityPreset,
    costCap: initialPerRunCostCapUsd,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty =
    text !== saved.text ||
    image !== saved.image ||
    search !== saved.search ||
    costCap !== saved.costCap;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        synthesisQuality: text,
        visionQuality: image,
        perplexityPreset: search,
        perRunCostCapUsd: costCap,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        text: r.data.atlasSynthesisQuality,
        image: r.data.atlasVisionQuality,
        search: r.data.atlasPerplexityPreset,
        costCap: r.data.atlasPerRunCostCapUsd,
      });
      setText(r.data.atlasSynthesisQuality);
      setImage(r.data.atlasVisionQuality);
      setSearch(r.data.atlasPerplexityPreset);
      setCostCap(r.data.atlasPerRunCostCapUsd);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<Sparkles className="text-muted-foreground h-4 w-4" />}
      title="Models & cost"
      subtitle="The four models every step draws on, and the per-run USD ceiling the Enricher enforces mid-run. Text drives function 9 and the image-rank leg; Image drives function 6; Search drives Agent X at function 3 and Agent Y at function 4; Embeddings is locked. High quality is identical to Standard today (both gpt-4o)."
    >
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ModelSelect
          icon={<Brain className="text-muted-foreground h-4 w-4" />}
          label="Text model"
          hint="writes the profile"
          value={text}
          onChange={setText}
          options={QUALITY_OPTIONS}
          disabled={pending}
        />
        <ModelSelect
          icon={<Eye className="text-muted-foreground h-4 w-4" />}
          label="Image model"
          hint="analyzes photos"
          value={image}
          onChange={setImage}
          options={QUALITY_OPTIONS}
          disabled={pending}
        />
        <ModelSelect
          icon={<Globe className="text-muted-foreground h-4 w-4" />}
          label="Search model"
          hint="Agent X + Y preset"
          value={search}
          onChange={setSearch}
          options={PERPLEXITY_OPTIONS}
          disabled={pending}
        />
        <ModelDisplay
          icon={<Database className="text-muted-foreground h-4 w-4" />}
          label="Embeddings model"
          hint="place vectors"
          value={EMBEDDINGS_MODEL_LABEL}
          detail={EMBEDDINGS_MODEL_DETAIL}
        />
      </div>

      <div className="mt-4 sm:max-w-xs">
        <NumberField
          icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
          label="Per-run cost cap (USD)"
          value={costCap}
          min={0}
          max={100}
          decimals
          onChange={setCostCap}
          disabled={pending}
        />
        <p className="text-muted-foreground mt-2 type-label leading-snug">
          Enforced mid-run by EnrichCostLedger against{" "}
          <code className="font-mono">atlas_per_run_cost_cap_usd</code>. 0 blocks paid steps.
        </p>
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

function ModelSelect<T extends string>({
  icon,
  label,
  hint,
  value,
  onChange,
  options,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint: string }[];
  disabled: boolean;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
        <span className="text-muted-foreground type-label font-normal">· {hint}</span>
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="border-border bg-card focus:border-foreground h-9 rounded-lg border px-2 text-sm outline-none disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} · {o.hint}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Read-only model card — pipeline-locked values the admin must not change. */
function ModelDisplay({
  icon,
  label,
  hint,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-xl border p-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
        <span className="text-muted-foreground type-label font-normal">· {hint}</span>
        <Lock className="text-muted-foreground ml-auto h-3.5 w-3.5 shrink-0" aria-hidden />
      </span>
      <div
        className="border-border bg-card text-foreground flex h-9 items-center rounded-lg border px-2 text-sm"
        aria-readonly="true"
      >
        <span className="truncate">{value}</span>
      </div>
      <p className="text-muted-foreground type-label leading-snug">{detail}</p>
    </div>
  );
}

// ── The steps that have no knobs ───────────────────────────────────────────
//
// A config page that lists only the tunable steps reads like the pipeline has
// four. It has ten plus an extra, and the honest answer for most of them is
// "nothing to tune" — either Google's answer IS the answer, or the only knob is
// a shared model that lives in the box above. Saying so beats leaving an
// operator to wonder which page hides the rest.
//
// No save, no state: this box is a map, not a form.
const QUIET_STEPS: { step: string; name: string; why: string }[] = [
  {
    step: "0",
    name: "Seed",
    why:
      "The gate the queue stands on. A Google Place ID either resolves or no row is created at all — there is nothing to tune about a hard stop. `enriched = 0` means exactly this: seeded, nothing after it.",
  },
  {
    step: "1",
    name: "Pulse",
    why:
      "One question: is the place still active. Not the hours, not the address — just whether the listing is alive, so a dead place is caught before a dollar is spent on it. It re-hits Place Details on purpose; paying twice buys a liveness gate that means one thing.",
  },
  {
    step: "2",
    name: "Details",
    why:
      "Everything else Google knows — the hours, address, geo, zone, city, timezone, price, phone — and the name. The hours live here, not on Pulse: a place that publishes none is missing data, not closed for business. `places.name` is generated from `coalesce(mesita_name, google_name)`; the override is `mesita_name`, which lives on the place, not in config.",
  },
  {
    step: "3",
    name: "Serp",
    why:
      "Bought to feed Links: Agent Y cannot pick between five Instagram candidates on a name and a city, and this editorial read is what it recognises the place by. Function 9 reuses it, but that is not why it exists. Its one knob is the Search model preset, in Models above.",
  },
  {
    step: "7",
    name: "Menu",
    why:
      "A stub. The website is no longer crawled, so no menu source exists — it always passes and can never block the queue.",
  },
  {
    step: "9",
    name: "Description",
    why:
      "The Profile Description, then Category, Tags and Presentation. Its one knob is the Text model tier, in Models above; the category and tag vocabularies are closed and code-defined.",
  },
  {
    step: "◇",
    name: "Semantic · Name",
    why:
      "Outside the queue, so it never counts toward Enriched: the Mesita Name as its own vector. NOT BUILT — today a single embedding covers the whole facts block.",
  },
  {
    step: "◇",
    name: "Semantic · Summary",
    why:
      "Outside the queue too: the 60-word Semantic Summary and its vector, re-run on any profile edit. The embeddings model is LOCKED — swapping it changes dimensions and re-embeds the whole catalog.",
  },
];

export function QuietStepsSection() {
  return (
    <SectionCard
      icon={<ListChecks className="h-4 w-4" />}
      title="The rest of the pipeline"
      subtitle="Every other function, and where its knob lives if it has one. ◇ marks the two semantic functions, which sit outside the numbered queue. Nothing here to save."
    >
      <ul className="divide-border/60 divide-y">
        {QUIET_STEPS.map((s) => (
          <li key={s.step} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="bg-muted text-muted-foreground mt-0.5 inline-flex h-6 shrink-0 items-center justify-center rounded-md px-1.5 type-label font-semibold tabular-nums">
              {s.step}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                {s.why}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
