"use client";

import { useState, useTransition } from "react";
import {
  Brain,
  CalendarClock,
  CheckCheck,
  Database,
  Eye,
  Facebook,
  Globe,
  Image as ImageIcon,
  Images,
  Instagram,
  Link2,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import { updateAtlasConfig, type PerplexityPreset, type SynthesisQuality } from "./actions";
import {
  Collapsible,
  ErrorNote,
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

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

// Enforce the per-source chain, reducing downstream values to fit:
//   Google analyze ≤ Google collect · IG analyze ≤ IG collect ·
//   save ≤ (Google analyze + IG analyze), capped at 10.
function normalizeFunnel(s: Funnel): Funnel {
  const gg = clampN(s.gg, 1, 10); // Google collect
  const depth = clampN(s.depth, 1, 50); // Instagram collect (downloaded, sorted by likes)
  const ag = clampN(s.ag, 1, gg); // Google analyze ≤ Google collect
  const ai = clampN(s.ai, 1, depth); // Instagram analyze ≤ Instagram collect
  const save = clampN(s.save, 1, Math.min(10, ag + ai)); // Selection ≤ analyzed, ≤ 10
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
        {hint && <span className="text-muted-foreground text-[11px] font-normal">{hint}</span>}
      </span>
      {status}
    </div>
  );
}

// One "Images" box: the whole photo funnel (Collection → Analysis → Selection)
// as three subsections in a single card, plus the S9 Storage-mirror binary.
// Image analysis is ALWAYS on — there is no vision toggle — so every analyze
// count is live. The per-source lock still holds (analyze ≤ collect, keep ≤
// analyzed total); the numeric knobs batch under one Save, and the Storage
// binary saves on the spot like a feature switch.
export function ImageFunnelSection({
  initialGatherGoogleImages,
  initialGatherInstagramDepth,
  initialAnalyzeGoogleImages,
  initialAnalyzeInstagramImages,
  initialSaveTotalImages,
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
  const [storage, setStorage] = useState(initialSaveImagesToStorage);
  const [saved, setSaved] = useState({
    ...init,
    analysisPrompt: initialImageAnalysisPrompt,
    sortingPrompt: initialImageSortingPrompt,
  });
  const [savePending, startSave] = useTransition();
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
      title="Images"
      subtitle="How the Enricher builds a place's gallery: collect a candidate pool per source, analyze the top of each (which also picks what's kept), then choose how many reach the profile."
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
          <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Google collect" value={f.gg} min={1} max={10} onChange={(v) => patch({ gg: v })} disabled={savePending} />
          <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram collect" value={f.depth} min={1} max={50} onChange={(v) => patch({ depth: v })} disabled={savePending} />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Google returns its photos already ranked by relevance — best first, so we take them in order. Instagram returns the <em>most recent</em> posts, so the Enricher re-ranks that window by number of likes. No separate keep step — Analysis reads the top of each pool.
        </p>
      </div>

      {/* ── Analysis ── */}
      <div className="border-border mt-6 border-t pt-6">
        <SubHeading
          icon={<Eye className="text-muted-foreground h-4 w-4" />}
          title="Analysis"
          hint="always on · largest cost driver"
          status={<StageTotal label="analyzed" n={aSum} />}
        />
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Analyze Google images (≤ Google collect)" value={f.ag} min={1} max={f.gg} onChange={(v) => patch({ ag: v })} disabled={savePending} />
          <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Analyze Instagram images (≤ Instagram collect)" value={f.ai} min={1} max={f.depth} onChange={(v) => patch({ ai: v })} disabled={savePending} />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          The vision model describes the first N of each pool — Google&apos;s most-relevant and Instagram&apos;s most-liked — then re-ranks all of them by photo quality for the final gallery. The number you analyze is the number you keep — Google ≤ <span className="text-foreground font-semibold tabular-nums">{f.gg}</span>, Instagram ≤ <span className="text-foreground font-semibold tabular-nums">{f.depth}</span>.
        </p>

        <Collapsible summary="Edit photo analysis prompts">
          <div className="space-y-4">
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
            max={Math.min(10, aSum)}
            onChange={(v) => patch({ save: v })}
            disabled={savePending}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          After ranking, the top <span className="text-foreground font-semibold tabular-nums">{f.save}</span> across all sources are saved to the profile — capped at the analysis total (<span className="tabular-nums">{aSum}</span>), up to 10.
        </p>
      </div>

      {/* ── Storage binary ── */}
      <div className="border-border mt-6 border-t pt-6">
        <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4 xl:flex-row xl:items-center xl:justify-between">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Database className="text-muted-foreground h-4 w-4" />
            Save selected images to Supabase Storage
            <span className="text-muted-foreground text-[11px]">off = render from source URLs</span>
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
          Analyze <span className="font-semibold">{aSum}</span>
          <span className="text-muted-foreground"> ≥ </span>
          Keep <span className="font-semibold">{f.save}</span>
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
      title="Links"
      subtitle="How many Firecrawl Search candidates to pull per source (0–10) when finding a place's official links. Agent Y reviews these and picks the best one per field (or none). 0 turns a source off."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumberField icon={<Globe className="text-muted-foreground h-4 w-4" />} label="Website" value={website} min={0} max={10} onChange={setWebsite} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram" value={instagram} min={0} max={10} onChange={setInstagram} disabled={pending} />
        <NumberField icon={<Facebook className="text-muted-foreground h-4 w-4" />} label="Facebook" value={facebook} min={0} max={10} onChange={setFacebook} disabled={pending} />
        <NumberField icon={<CalendarClock className="text-muted-foreground h-4 w-4" />} label="OpenTable" value={opentable} min={0} max={10} onChange={setOpentable} disabled={pending} />
        <NumberField icon={<ShoppingBag className="text-muted-foreground h-4 w-4" />} label="Uber Eats" value={ubereats} min={0} max={10} onChange={setUbereats} disabled={pending} />
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
      title="Reviews"
      subtitle="How many Google reviews Apify scrapes for the Enricher (0–100). Google Places itself only returns ~5; 100 is Mesita's hard safety bound for Edge Function wall-clock and Apify cost (~$0.50 per 100), not a Google limit. More reviews ground richer About / category / tags synthesis, but slow and price the scrape."
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

const QUALITY_OPTIONS: { value: SynthesisQuality; label: string; hint: string }[] = [
  { value: "economy", label: "Economy", hint: "gpt-4o-mini" },
  { value: "standard", label: "Standard", hint: "gpt-4o" },
  { value: "high", label: "High", hint: "gpt-4o" },
];

// Perplexity Agent presets — the "search model" for S2 (SERP) + S3 (links).
// Cost/depth climbs down the list; pro-search is the default.
const PERPLEXITY_OPTIONS: { value: PerplexityPreset; label: string; hint: string }[] = [
  { value: "fast-search", label: "Fast", hint: "1 step · cheapest" },
  { value: "pro-search", label: "Pro", hint: "5 steps · default" },
  { value: "deep-research", label: "Deep", hint: "10 steps · pricey" },
  { value: "advanced-deep-research", label: "Advanced", hint: "15 steps · priciest" },
];

// ─── Models (text synthesis model + image vision model) ─────────────────────

export function ModelsSection({
  initialSynthesisQuality,
  initialVisionQuality,
  initialPerplexityPreset,
  onSaved,
}: {
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialPerplexityPreset: PerplexityPreset;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [text, setText] = useState<SynthesisQuality>(initialSynthesisQuality);
  const [image, setImage] = useState<SynthesisQuality>(initialVisionQuality);
  const [search, setSearch] = useState<PerplexityPreset>(initialPerplexityPreset);
  const [saved, setSaved] = useState({
    text: initialSynthesisQuality,
    image: initialVisionQuality,
    search: initialPerplexityPreset,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = text !== saved.text || image !== saved.image || search !== saved.search;

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        synthesisQuality: text,
        visionQuality: image,
        perplexityPreset: search,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        text: r.data.atlasSynthesisQuality,
        image: r.data.atlasVisionQuality,
        search: r.data.atlasPerplexityPreset,
      });
      setText(r.data.atlasSynthesisQuality);
      setImage(r.data.atlasVisionQuality);
      setSearch(r.data.atlasPerplexityPreset);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<Sparkles className="text-muted-foreground h-4 w-4" />}
      title="Models"
      subtitle="Which AI models write the profile (text), analyze photos (vision), and search the web (Perplexity, for the SERP summary + link discovery)."
    >
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          hint="Perplexity preset"
          value={search}
          onChange={setSearch}
          options={PERPLEXITY_OPTIONS}
          disabled={pending}
        />
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
        <span className="text-muted-foreground text-[11px] font-normal">· {hint}</span>
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
