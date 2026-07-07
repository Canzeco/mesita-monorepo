"use client";

import { useState, useTransition } from "react";
import {
  Brain,
  CalendarClock,
  Eye,
  Facebook,
  Globe,
  Image as ImageIcon,
  Instagram,
  Link2,
  Lock,
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

// ─── Gather (per-source fetch depth: pages, images, posts) ──────────────────
// One card for every "how much to pull" knob — website crawl depth plus the
// image/post candidate counts per source. Four fields sit on one row at wide
// widths, so the card fills the space instead of a half-empty grid.

export function GatherSection({
  initialGatherGoogleImages,
  initialGatherInstagramDepth,
  initialGatherInstagramPosts,
  onSaved,
}: {
  initialGatherGoogleImages: number;
  initialGatherInstagramDepth: number;
  initialGatherInstagramPosts: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [g, setG] = useState(initialGatherGoogleImages);
  const [depth, setDepth] = useState(initialGatherInstagramDepth);
  const [posts, setPosts] = useState(initialGatherInstagramPosts);
  const [saved, setSaved] = useState({
    g: initialGatherGoogleImages,
    depth: initialGatherInstagramDepth,
    posts: initialGatherInstagramPosts,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty =
    g !== saved.g ||
    depth !== saved.depth ||
    posts !== saved.posts;

  // Keep ≤ depth: lowering the download depth can never leave keep above it.
  const keepMax = Math.min(10, depth);
  const setDepthClamped = (n: number) => {
    setDepth(n);
    if (posts > n) setPosts(n);
  };

  const save = () => {
    if (!dirty) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateAtlasConfig({
        gatherGoogleImages: g,
        gatherInstagramDepth: depth,
        gatherInstagramPosts: posts,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved({
        g: r.data.atlasGatherGoogleImages,
        depth: r.data.atlasGatherInstagramDepth,
        posts: r.data.atlasGatherInstagramPosts,
      });
      setG(r.data.atlasGatherGoogleImages);
      setDepth(r.data.atlasGatherInstagramDepth);
      setPosts(r.data.atlasGatherInstagramPosts);
      onSaved(r.data.updatedAt);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<ImageIcon className="text-muted-foreground h-4 w-4" />}
      title="Collection"
      subtitle="How much raw material ADEA collects before analysis. These limits set how many images or posts to fetch per source — not how many end up on the profile."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Google images" value={g} min={0} max={10} onChange={setG} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram depth (download)" value={depth} min={1} max={30} onChange={setDepthClamped} disabled={pending} />
        <NumberField icon={<Instagram className="text-muted-foreground h-4 w-4" />} label="Instagram keep (≤ depth)" value={posts} min={0} max={keepMax} onChange={setPosts} disabled={pending} />
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
            <Instagram className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">Instagram</span> — download the latest{" "}
              <span className="font-medium">depth</span> posts, rank by likes, keep the
              top <span className="font-medium">keep</span> (video covers included).
            </span>
          </li>
        </ul>
      </div>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
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

// ─── Vision Params (how many saved images get analyzed) ─────────────────────

export function VisionParamsSection({
  initialImageVisionEnabled,
  initialAnalyzeGoogleImages,
  initialAnalyzeInstagramImages,
  initialSaveTotalImages,
  initialImageAnalysisPrompt,
  initialImageSortingPrompt,
  onSaved,
}: {
  initialImageVisionEnabled: boolean;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
  initialSaveTotalImages: number;
  initialImageAnalysisPrompt: string;
  initialImageSortingPrompt: string;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [vision, setVision] = useState(initialImageVisionEnabled);
  const [g, setG] = useState(initialAnalyzeGoogleImages);
  const [ig, setIg] = useState(initialAnalyzeInstagramImages);
  const [saveTotal, setSaveTotal] = useState(initialSaveTotalImages);
  const [analysisPrompt, setAnalysisPrompt] = useState(initialImageAnalysisPrompt);
  const [sortingPrompt, setSortingPrompt] = useState(initialImageSortingPrompt);
  const [saved, setSaved] = useState({
    g: initialAnalyzeGoogleImages,
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
        ig: r.data.atlasAnalyzeInstagramImages,
        saveTotal: r.data.atlasSaveTotalImages,
        analysisPrompt: r.data.atlasImageAnalysisPrompt,
        sortingPrompt: r.data.atlasImageSortingPrompt,
      });
      setG(r.data.atlasAnalyzeGoogleImages);
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

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <NumberField icon={<ImageIcon className="text-muted-foreground h-4 w-4" />} label="Analyze Google images" value={g} min={0} max={10} onChange={setG} disabled={savePending || !vision} />
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
