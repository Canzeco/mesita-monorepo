"use client";

import { useState, useTransition } from "react";
import {
  Brain,
  CalendarClock,
  CheckCheck,
  Eye,
  Facebook,
  Globe,
  Image as ImageIcon,
  Images,
  Instagram,
  Link2,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { updateAtlasConfig, type SynthesisQuality } from "./actions";
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
// Three stacked stages with a hard PER-SOURCE lock: every downstream count is
// bounded by its OWN source upstream, not by a shared sum. You can't keep more
// than you collected, analyze more of a source than you kept of it, or save
// more than you analyzed:
//   IG keep ≤ IG depth · Google/IG analyze ≤ that source's keep · save ≤ analyzed
// The lock is enforced live by clamping downstream values whenever an upstream
// one drops, and by capping each input's max against its own source — so an
// invalid config (e.g. analyze 15 IG when only 10 were kept) can never be
// entered, let alone saved.

type Funnel = { gg: number; depth: number; keep: number; ag: number; ai: number; save: number };

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

// Enforce the per-source chain, reducing downstream values to fit:
//   IG keep ≤ IG depth · Google analyze ≤ Google keep · IG analyze ≤ IG keep ·
//   save ≤ (Google analyze + IG analyze), capped at 10.
function normalizeFunnel(s: Funnel): Funnel {
  const gg = clampN(s.gg, 1, 10); // Google collect & keep
  const depth = clampN(s.depth, 1, 30); // Instagram download depth
  const keep = clampN(s.keep, 1, depth); // Instagram keep ≤ depth
  const ag = clampN(s.ag, 1, gg); // Google analyze ≤ Google keep
  const ai = clampN(s.ai, 1, keep); // Instagram analyze ≤ Instagram keep
  const save = clampN(s.save, 1, Math.min(10, ag + ai)); // Selection ≤ analyzed, ≤ 10
  return { gg, depth, keep, ag, ai, save };
}

function StageTotal({ label, n }: { label: string; n: number }) {
  return (
    <span className="border-border bg-background inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums">
      <span className="text-muted-foreground font-medium">{label}</span>
      {n}
    </span>
  );
}

export function ImageFunnelSection({
  initialGatherGoogleImages,
  initialGatherInstagramDepth,
  initialGatherInstagramPosts,
  initialImageVisionEnabled,
  initialAnalyzeGoogleImages,
  initialAnalyzeInstagramImages,
  initialSaveTotalImages,
  initialImageAnalysisPrompt,
  initialImageSortingPrompt,
  onSaved,
}: {
  initialGatherGoogleImages: number;
  initialGatherInstagramDepth: number;
  initialGatherInstagramPosts: number;
  initialImageVisionEnabled: boolean;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
  initialSaveTotalImages: number;
  initialImageAnalysisPrompt: string;
  initialImageSortingPrompt: string;
  onSaved: (updatedAt: string | null) => void;
}) {
  const init = normalizeFunnel({
    gg: initialGatherGoogleImages,
    depth: initialGatherInstagramDepth,
    keep: initialGatherInstagramPosts,
    ag: initialAnalyzeGoogleImages,
    ai: initialAnalyzeInstagramImages,
    save: initialSaveTotalImages,
  });
  const [f, setF] = useState<Funnel>(init);
  const [analysisPrompt, setAnalysisPrompt] = useState(initialImageAnalysisPrompt);
  const [sortingPrompt, setSortingPrompt] = useState(initialImageSortingPrompt);
  const [vision, setVision] = useState(initialImageVisionEnabled);
  const [saved, setSaved] = useState({
    ...init,
    analysisPrompt: initialImageAnalysisPrompt,
    sortingPrompt: initialImageSortingPrompt,
  });
  const [savePending, startSave] = useTransition();
  const [visionPending, startVision] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Every edit re-normalizes the whole funnel, so the lock holds at all times.
  const patch = (p: Partial<Funnel>) => {
    setOk(false);
    setF((cur) => normalizeFunnel({ ...cur, ...p }));
  };

  const cSum = f.gg + f.keep;
  const aSum = f.ag + f.ai;

  const dirty =
    f.gg !== saved.gg ||
    f.depth !== saved.depth ||
    f.keep !== saved.keep ||
    f.ag !== saved.ag ||
    f.ai !== saved.ai ||
    f.save !== saved.save ||
    analysisPrompt !== saved.analysisPrompt ||
    sortingPrompt !== saved.sortingPrompt;

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

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    startSave(async () => {
      const r = await updateAtlasConfig({
        gatherGoogleImages: f.gg,
        gatherInstagramDepth: f.depth,
        gatherInstagramPosts: f.keep,
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
        keep: r.data.atlasGatherInstagramPosts,
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
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* ── Stage 1 — Collection ── */}
      <SectionCard
        icon={<Images className="text-muted-foreground h-4 w-4" />}
        title="Images · Collection"
        subtitle="How many images the Enricher pulls into the candidate pool per source. Instagram downloads a deeper window, ranks it by likes, and keeps the top few."
        status={<StageTotal label="collected" n={cSum} />}
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Google collect & keep" value={f.gg} min={1} max={10} onChange={(v) => patch({ gg: v })} disabled={savePending} />
          <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram collect (download)" value={f.depth} min={1} max={30} onChange={(v) => patch({ depth: v })} disabled={savePending} />
          <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram keep (≤ collect)" value={f.keep} min={1} max={f.depth} onChange={(v) => patch({ keep: v })} disabled={savePending} />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Collection total = Google images + Instagram keep = <span className="text-foreground font-semibold tabular-nums">{cSum}</span>. Depth only sets how deep to look before the likes-sort; it doesn&apos;t add to the pool.
        </p>
      </SectionCard>

      {/* ── Stage 2 — Analysis ── */}
      <SectionCard
        icon={<Eye className="text-muted-foreground h-4 w-4" />}
        title="Images · Analysis"
        subtitle="Of what each source kept, how many images the vision model describes and ranks. Never more than that source kept."
        status={<StageTotal label="analyzed" n={aSum} />}
      >
        <div className="mt-5">
          <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4 xl:flex-row xl:items-center xl:justify-between">
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <Eye className="text-muted-foreground h-4 w-4" />
              Enable image analysis
              <span className="text-muted-foreground text-[11px]">(largest cost driver)</span>
            </span>
            <Switch on={vision} pending={visionPending} onClick={flipVision} label="Toggle image vision" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Analyze Google images (≤ Google keep)" value={f.ag} min={1} max={f.gg} onChange={(v) => patch({ ag: v })} disabled={savePending || !vision} />
          <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Analyze Instagram images (≤ Instagram keep)" value={f.ai} min={1} max={f.keep} onChange={(v) => patch({ ai: v })} disabled={savePending || !vision} />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Each source is capped at what it kept — Google ≤ <span className="text-foreground font-semibold tabular-nums">{f.gg}</span>, Instagram ≤ <span className="text-foreground font-semibold tabular-nums">{f.keep}</span>. You can&apos;t describe an image you didn&apos;t keep.
        </p>

        <Collapsible summary="Edit photo analysis prompts">
          <div className="space-y-4">
            <TextAreaField label="Image analysis prompt" value={analysisPrompt} onChange={(v) => { setOk(false); setAnalysisPrompt(v); }} disabled={savePending || !vision} />
            <TextAreaField label="Image sorting prompt" value={sortingPrompt} onChange={(v) => { setOk(false); setSortingPrompt(v); }} disabled={savePending || !vision} />
          </div>
        </Collapsible>
      </SectionCard>

      {/* ── Stage 3 — Selection ── */}
      <SectionCard
        icon={<CheckCheck className="text-muted-foreground h-4 w-4" />}
        title="Images · Selection"
        subtitle="After analysis + ranking, how many top images are saved to the place profile (all sources combined). Can never exceed the Analysis total."
        status={<StageTotal label="kept" n={f.save} />}
      >
        <div className="mt-5">
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
          Selection <span className="text-foreground font-semibold tabular-nums">{f.save}</span> is capped at the Analysis total (<span className="tabular-nums">{aSum}</span>), up to 10.
        </p>
      </SectionCard>

      {/* ── Shared funnel footer: the invariant, at a glance, + one save ── */}
      <div className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-sm font-medium tabular-nums">
          <span className="text-muted-foreground">Funnel</span>{" "}
          Collection <span className="font-semibold">{cSum}</span>
          <span className="text-muted-foreground"> ≥ </span>
          Analysis <span className="font-semibold">{aSum}</span>
          <span className="text-muted-foreground"> ≥ </span>
          Selection <span className="font-semibold">{f.save}</span>
        </p>
        <div className="flex items-center">
          <SaveRow pending={savePending} dirty={dirty} ok={ok} onClick={save} />
        </div>
      </div>
      {error && <ErrorNote message={error} />}
    </div>
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
      title="Link Discovery"
      subtitle="How many Firecrawl Search candidates to pull per source when finding a place's official links. Agent Y reviews these and picks the best one per field (or none). 0 turns a source off."
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

const QUALITY_OPTIONS: { value: SynthesisQuality; label: string; hint: string }[] = [
  { value: "economy", label: "Economy", hint: "gpt-4o-mini" },
  { value: "standard", label: "Standard", hint: "gpt-4o" },
  { value: "high", label: "High", hint: "gpt-4o" },
];

// ─── Models (text synthesis model + image vision model) ─────────────────────

export function ModelsSection({
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
