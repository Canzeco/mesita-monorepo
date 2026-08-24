"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Facebook,
  Globe,
  Image as ImageIcon,
  Instagram,
  Loader2,
  MessageSquareQuote,
  ShoppingBag,
  Star,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  NumberField,
  QualityPicker,
  Switch,
  TextAreaField,
} from "@/components/admin-ui/config";
import { SourcingChannels } from "../sourcing-config/SourcingConfigClient";
import { updateSourcingConfig } from "../sourcing-config/actions";
import type { SourcingConfig } from "../sourcing-config/catalog";
import {
  updateAtlasConfig,
  type PerplexityPreset,
  type SynthesisQuality,
} from "./actions";
import {
  Band,
  Fields,
  FlowCard,
  FunctionBlock,
  KnobElsewhere,
  NoKnobs,
  SelectField,
  Tag,
} from "./blocks";
import { SectionStrip } from "./SectionStrip";

// THE INTAKE PAGE. Five sections in Pato's order (MESITA-1287):
//   1 Sourcing · 2 Create explained · 3 Enrich explained · 4 the functions · 5 Models
//
// ONE SAVE over TWO write doors — app_config.sourcing_config through
// admin-web-update-sourcing-config, and the atlas_* columns through
// admin-web-update-enricher-config. They are not one transaction, so the bar
// tells the truth about a half-landed write instead of claiming atomicity it
// does not have: sourcing is written first, and if the second call fails the
// bar says which half landed and only the failed half stays dirty.
//
// NO TRIGGER GRID. What a run is allowed to buy lives in
// app_config.enrichment_triggers and is written by the EF alone (Pato, three
// times: 2026-08-21 "delete the triggers shit", 2026-08-23 "Fuck this page",
// 2026-08-23 "delete this stupid box"). Do not restore it as a fix.

const MAX_GOOGLE_COLLECT = 10;
const MAX_INSTAGRAM_COLLECT = 30;
const MAX_SAVE_IMAGES = 10; // DB CHECK app_config_atlas_save_total_images_range
const MAX_DISCOVERY_CANDIDATES = 10;

const PERPLEXITY_OPTIONS: readonly { value: PerplexityPreset; label: string }[] =
  [
    { value: "fast-search", label: "fast-search" },
    { value: "pro-search", label: "pro-search" },
    { value: "deep-research", label: "deep-research" },
    { value: "advanced-deep-research", label: "advanced-deep-research" },
  ];

export type IntakeSettings = {
  gatherGoogleImages: number;
  gatherInstagramDepth: number;
  gatherReviews: number;
  imageVisionEnabled: boolean;
  saveImagesToStorage: boolean;
  saveTotalImages: number;
  analyzeGoogleImages: number;
  analyzeInstagramImages: number;
  imageAnalysisPrompt: string;
  imageSortingPrompt: string;
  synthesisQuality: SynthesisQuality;
  visionQuality: SynthesisQuality;
  perplexityPreset: PerplexityPreset;
  perRunCostCapUsd: number;
  discoverWebsiteN: number;
  discoverInstagramN: number;
  discoverFacebookN: number;
  discoverOpentableN: number;
  discoverUbereatsN: number;
};

const clampN = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(v)));

/**
 * The image funnel is a chain, and the EF rejects a broken one with a 400, so
 * the page clamps downstream values instead of letting a save bounce:
 * analyze ≤ collect per source, and the gallery ≤ everything analyzed.
 */
function clampFunnel(s: IntakeSettings): IntakeSettings {
  const gatherGoogleImages = clampN(s.gatherGoogleImages, 1, MAX_GOOGLE_COLLECT);
  const gatherInstagramDepth = clampN(
    s.gatherInstagramDepth,
    1,
    MAX_INSTAGRAM_COLLECT,
  );
  const analyzeGoogleImages = clampN(
    s.analyzeGoogleImages,
    1,
    gatherGoogleImages,
  );
  const analyzeInstagramImages = clampN(
    s.analyzeInstagramImages,
    1,
    gatherInstagramDepth,
  );
  return {
    ...s,
    gatherGoogleImages,
    gatherInstagramDepth,
    analyzeGoogleImages,
    analyzeInstagramImages,
    saveTotalImages: clampN(
      s.saveTotalImages,
      1,
      Math.min(MAX_SAVE_IMAGES, analyzeGoogleImages + analyzeInstagramImages),
    ),
  };
}

export function IntakeClient({
  initialSourcing,
  sourcingUpdatedAt,
  sourcingLoadError,
  initialSettings,
  settingsUpdatedAt,
  settingsLoadError,
}: {
  initialSourcing: SourcingConfig;
  sourcingUpdatedAt: string | null;
  sourcingLoadError: string | null;
  initialSettings: IntakeSettings;
  settingsUpdatedAt: string | null;
  settingsLoadError: string | null;
}) {
  const [sourcing, setSourcing] = useState(initialSourcing);
  const [savedSourcing, setSavedSourcing] = useState(initialSourcing);
  const [sourcingStamp, setSourcingStamp] = useState(sourcingUpdatedAt);

  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [settingsStamp, setSettingsStamp] = useState(settingsUpdatedAt);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const sourcingDirty = useMemo(
    () => JSON.stringify(sourcing) !== JSON.stringify(savedSourcing),
    [sourcing, savedSourcing],
  );
  const settingsDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings],
  );
  const dirty = sourcingDirty || settingsDirty;

  // A failed GET must never let a save overwrite the live singleton with
  // defaults (MESITA-737) — the half that failed to load cannot be saved.
  const blocked = sourcingLoadError ?? settingsLoadError;

  const dirtyNames = [
    sourcingDirty ? "Sourcing" : null,
    settingsDirty ? "the Intaker" : null,
  ].filter(Boolean);

  const patch = (next: Partial<IntakeSettings>) => {
    setSettings((s) => clampFunnel({ ...s, ...next }));
    setOk(false);
    setPartial(null);
  };

  const save = () => {
    if (blocked) return;
    setError(null);
    setPartial(null);
    startTransition(async () => {
      let sourcingLanded = false;
      let failure: string | null = null;

      if (sourcingDirty) {
        const r = await updateSourcingConfig(sourcing);
        if (r.ok) {
          setSourcing(r.config);
          setSavedSourcing(r.config);
          setSourcingStamp(r.updatedAt);
          sourcingLanded = true;
        } else {
          setError(`Sourcing: ${r.error}`);
          return; // nothing else was attempted, so nothing else can be half-saved
        }
      }

      if (settingsDirty) {
        const r = await updateAtlasConfig({
          gatherGoogleImages: settings.gatherGoogleImages,
          gatherInstagramDepth: settings.gatherInstagramDepth,
          gatherReviews: settings.gatherReviews,
          imageVisionEnabled: settings.imageVisionEnabled,
          saveImagesToStorage: settings.saveImagesToStorage,
          saveTotalImages: settings.saveTotalImages,
          analyzeGoogleImages: settings.analyzeGoogleImages,
          analyzeInstagramImages: settings.analyzeInstagramImages,
          imageAnalysisPrompt: settings.imageAnalysisPrompt,
          imageSortingPrompt: settings.imageSortingPrompt,
          synthesisQuality: settings.synthesisQuality,
          visionQuality: settings.visionQuality,
          perplexityPreset: settings.perplexityPreset,
          perRunCostCapUsd: settings.perRunCostCapUsd,
          discoverWebsiteN: settings.discoverWebsiteN,
          discoverInstagramN: settings.discoverInstagramN,
          discoverFacebookN: settings.discoverFacebookN,
          discoverOpentableN: settings.discoverOpentableN,
          discoverUbereatsN: settings.discoverUbereatsN,
        });
        if (r.ok) {
          setSavedSettings(settings);
          setSettingsStamp(r.data.updatedAt);
        } else {
          failure = r.error;
        }
      }

      if (failure) {
        // The seam, said out loud. Sourcing is already committed; the Intaker
        // half is not, stays dirty, and a retry writes only what is missing.
        setPartial(
          sourcingLanded
            ? "Sourcing saved · the Intaker did not."
            : "The Intaker did not save.",
        );
        setError(failure);
        return;
      }
      setOk(true);
    });
  };

  const discard = () => {
    setSourcing(savedSourcing);
    setSettings(savedSettings);
    setError(null);
    setPartial(null);
    setOk(false);
  };

  return (
    <>
      <SectionStrip />

      <div className="pb-24">
        {/* ══ 1 · SOURCING ══ */}
        <Band
          n="1"
          id="s-sourcing"
          title="Sourcing"
          aside={<Tag tone="solid">the gate, before a place exists</Tag>}
        />
        {sourcingLoadError ? (
          <ErrorNote message={`Sourcing failed to load: ${sourcingLoadError}`} />
        ) : (
          <SourcingChannels
            config={sourcing}
            onChange={(next) => {
              setSourcing(next);
              setOk(false);
              setPartial(null);
            }}
            disabled={pending}
            updatedAt={sourcingStamp}
          />
        )}

        {/* ══ 2 · CREATE ══ */}
        <Band
          n="2"
          id="s-create"
          title="Create"
          aside={<Tag>$ · one Google call</Tag>}
        />
        <FlowCard
          title="One function, synchronous, at the door"
          blurb="Runs inline for admin, business and consumer alike. The Intaker never calls it — a person or Memo does, by adding a place."
          facts={[
            {
              term: "What starts it",
              detail:
                "Someone adds a place. There is no trigger for Create — it is unconditional, and the gate above is what decides whether the add is allowed at all.",
            },
            {
              term: "The gate inside it",
              detail: (
                <>
                  A listing Google reports{" "}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    CLOSED_PERMANENTLY
                  </code>{" "}
                  is refused <b>422</b> before any row exists. A dead place never
                  enters the catalog.
                </>
              ),
            },
            {
              term: "What it leaves behind",
              detail:
                "The paired place and project rows, the Google spine, a first photo, and a queued Summary vector. It stamps pulse and details, so a healthy fresh place reads Enriched 2/9 the moment it exists.",
            },
            {
              term: "Then",
              detail:
                "It schedules the enrich queue — it never runs functions 3–9 inline.",
            },
          ]}
          steps={[
            { href: "#f-seed", label: "Seed" },
            { href: "#f-pulse", label: "Pulse" },
            { href: "#f-details", label: "Details" },
            { href: "#f-summary", label: "◇ Summary" },
            { href: "#f-name", label: "◇ Name" },
          ]}
          footer={
            <>
              No knobs of its own. Everything Create does is a function in §4,
              and the semantic pair rides along outside the 0–9 count.
            </>
          }
        />

        {/* ══ 3 · ENRICH ══ */}
        <Band
          n="3"
          id="s-enrich"
          title="Enrich"
          aside={<Tag>$$ · Apify · Firecrawl · Perplexity</Tag>}
        />
        <FlowCard
          title="Nine functions, in order, queued per place"
          blurb="Three cron Edge Functions over the place_research staging row: research runs 1·2·3·4·5·8, analysis runs 6, contents runs 7·9·◇summary. A ~20s poller claims staged rows and fires each stage."
          facts={[
            {
              term: "Cadence",
              detail: (
                <>
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    places.enrich_every_days
                  </code>
                  , set per place on the Place editor — not here. The queue runs
                  every 15 minutes and seeds at most <b>5 places per tick,
                  across all of Mesita</b>.
                </>
              ),
            },
            {
              term: "What stops it",
              detail:
                "Infrastructure failure halts the queue, and so does a permanently-closed listing. Absence is a result, not a failure — a place with no Instagram still reaches 9.",
            },
            {
              term: "Ceiling",
              detail: "The per-run cost cap in §5, enforced mid-run.",
            },
          ]}
          steps={[
            { href: "#f-pulse", label: "1 Pulse" },
            { href: "#f-details", label: "2 Details" },
            { href: "#f-serp", label: "3 Serp" },
            { href: "#f-links", label: "4 Links" },
            { href: "#f-social", label: "5 Social" },
            { href: "#f-images", label: "6 Images" },
            { href: "#f-menu", label: "7 Menu" },
            { href: "#f-reviews", label: "8 Reviews" },
            { href: "#f-description", label: "9 Description" },
            { href: "#f-summary", label: "◇ Summary" },
            { href: "#f-name", label: "◇ Name" },
          ]}
          footer={
            <>
              <b>What a run is allowed to buy is not set here.</b> That lives in{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                app_config.enrichment_triggers
              </code>
              , written by{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                admin-web-update-enricher-config
              </code>
              . Two events fire today: the run Create schedules, and the
              per-place decay refresh. The Google spine is never gated — every
              later function trusts it.
            </>
          }
        />

        {/* ══ 4 · THE FUNCTIONS ══ */}
        <Band
          n="4"
          title="The functions"
          aside={<Tag tone="solid">12 functions · 15 knobs</Tag>}
        />
        <p className="text-muted-foreground -mt-1 mb-4 max-w-3xl text-sm leading-relaxed">
          In run order, each listed once with the flows that call it. Pulse,
          Details and the semantic pair appear in both flows because they are the
          same function with two callers — printing them twice would invent a
          second ladder.
        </p>

        <FunctionBlock
          id="f-seed"
          index="SEED"
          flows="Create"
          name="Seed"
          blurb="Dedupe on the Google Place ID and mint the paired rows at category='undefined'."
        >
          <NoKnobs>
            No knobs. The row existing <b>is</b> the seed, which is why it is not
            an enrich function and never gets stamped.
          </NoKnobs>
        </FunctionBlock>

        <FunctionBlock
          id="f-pulse"
          index="1 · $"
          flows="Create + Enrich"
          name="Pulse"
          blurb="One question: is this place still alive. Not the hours, not the address."
        >
          <NoKnobs>
            No knobs. Google&apos;s <b>businessStatus</b> is the answer and it is
            not tunable. It runs before the cost ledger opens — a gate that
            reports at the end of the stage is not a gate.
          </NoKnobs>
        </FunctionBlock>

        <FunctionBlock
          id="f-details"
          index="2 · $"
          flows="Create + Enrich"
          name="Details"
          blurb="The Google spine: hours, address, geo, zone, city, timezone, price, phone, and the name."
        >
          <NoKnobs>
            No knobs. Every field here is a fact Google states. The one override
            is <b>mesita_name</b>, owned by a human on the Place editor —
            enrichment never touches it.
          </NoKnobs>
        </FunctionBlock>

        <FunctionBlock
          id="f-serp"
          index="3 · $"
          flows="Enrich"
          name="Serp"
          blurb="Agent X writes the editorial read that Links spends to recognise the place. Never a source of facts."
        >
          <KnobElsewhere>
            Its only knob is the <b>Search model preset</b> in §5 — one value
            with one home, because Agent Y at 4 · Links reads the same setting.
          </KnobElsewhere>
        </FunctionBlock>

        <FunctionBlock
          id="f-links"
          index="4 · $$"
          flows="Enrich"
          name="Links"
          blurb="Firecrawl gathers candidates per source, Agent Y picks one or none. Seed first, discover second."
        >
          <Fields>
            <NumberField
              icon={<Globe className="text-muted-foreground h-4 w-4" />}
              label="Website candidates"
              value={settings.discoverWebsiteN}
              min={0}
              max={MAX_DISCOVERY_CANDIDATES}
              onChange={(v) => patch({ discoverWebsiteN: v })}
              disabled={pending}
            />
            <NumberField
              icon={<Instagram className="text-muted-foreground h-4 w-4" />}
              label="Instagram candidates"
              value={settings.discoverInstagramN}
              min={0}
              max={MAX_DISCOVERY_CANDIDATES}
              onChange={(v) => patch({ discoverInstagramN: v })}
              disabled={pending}
            />
            <NumberField
              icon={<Facebook className="text-muted-foreground h-4 w-4" />}
              label="Facebook candidates"
              value={settings.discoverFacebookN}
              min={0}
              max={MAX_DISCOVERY_CANDIDATES}
              onChange={(v) => patch({ discoverFacebookN: v })}
              disabled={pending}
            />
            <NumberField
              icon={<Star className="text-muted-foreground h-4 w-4" />}
              label="OpenTable candidates"
              value={settings.discoverOpentableN}
              min={0}
              max={MAX_DISCOVERY_CANDIDATES}
              onChange={(v) => patch({ discoverOpentableN: v })}
              disabled={pending}
            />
            <NumberField
              icon={<ShoppingBag className="text-muted-foreground h-4 w-4" />}
              label="Uber Eats candidates"
              value={settings.discoverUbereatsN}
              min={0}
              max={MAX_DISCOVERY_CANDIDATES}
              onChange={(v) => patch({ discoverUbereatsN: v })}
              disabled={pending}
            />
          </Fields>
          <p className="text-muted-foreground mt-3 text-xs">
            0 turns a source off. A channel the Google spine already supplied at
            create is trusted as-is — discovery runs only for what is missing.
          </p>
        </FunctionBlock>

        <FunctionBlock
          id="f-social"
          index="5 · $$"
          flows="Enrich"
          name="Social"
          blurb="Instagram and Facebook. Runs before Images because its gather fills the pool the vision funnel ranks."
        >
          <Fields>
            <NumberField
              icon={<Instagram className="text-muted-foreground h-4 w-4" />}
              label="Instagram posts to collect"
              value={settings.gatherInstagramDepth}
              min={1}
              max={MAX_INSTAGRAM_COLLECT}
              onChange={(v) => patch({ gatherInstagramDepth: v })}
              disabled={pending}
            />
          </Fields>
          <p className="text-muted-foreground mt-3 text-xs">
            Newest first, then top-K by likes. This number bounds the Instagram
            analyze cap at 6 · Images.
          </p>
        </FunctionBlock>

        <FunctionBlock
          id="f-images"
          index="6 · $$"
          flows="Enrich"
          name="Images"
          blurb="Describe every candidate, rank them all in one shared bucket, keep the gallery. Largest cost driver here."
        >
          <Fields>
            <NumberField
              icon={<ImageIcon className="text-muted-foreground h-4 w-4" />}
              label="Google photos to collect"
              value={settings.gatherGoogleImages}
              min={1}
              max={MAX_GOOGLE_COLLECT}
              onChange={(v) => patch({ gatherGoogleImages: v })}
              disabled={pending}
            />
            <NumberField
              icon={<ImageIcon className="text-muted-foreground h-4 w-4" />}
              label="Analyze Google (≤ collected)"
              value={settings.analyzeGoogleImages}
              min={1}
              max={settings.gatherGoogleImages}
              onChange={(v) => patch({ analyzeGoogleImages: v })}
              disabled={pending || !settings.imageVisionEnabled}
            />
            <NumberField
              icon={<Instagram className="text-muted-foreground h-4 w-4" />}
              label="Analyze Instagram (≤ collected at 5)"
              value={settings.analyzeInstagramImages}
              min={1}
              max={settings.gatherInstagramDepth}
              onChange={(v) => patch({ analyzeInstagramImages: v })}
              disabled={pending || !settings.imageVisionEnabled}
            />
            <NumberField
              icon={<ImageIcon className="text-muted-foreground h-4 w-4" />}
              label="Photos kept on the profile"
              value={settings.saveTotalImages}
              min={1}
              max={Math.min(
                MAX_SAVE_IMAGES,
                settings.analyzeGoogleImages + settings.analyzeInstagramImages,
              )}
              onChange={(v) => patch({ saveTotalImages: v })}
              disabled={pending}
            />
            <div className="border-border bg-background flex items-center justify-between gap-3 rounded-xl border p-4">
              <span className="text-sm font-medium">Vision</span>
              <Switch
                on={settings.imageVisionEnabled}
                pending={pending}
                label="Toggle image vision"
                onClick={() =>
                  patch({ imageVisionEnabled: !settings.imageVisionEnabled })
                }
              />
            </div>
            <div className="border-border bg-background flex items-center justify-between gap-3 rounded-xl border p-4">
              <span className="text-sm font-medium">Mirror to storage</span>
              <Switch
                on={settings.saveImagesToStorage}
                pending={pending}
                label="Toggle image storage"
                onClick={() =>
                  patch({ saveImagesToStorage: !settings.saveImagesToStorage })
                }
              />
            </div>
          </Fields>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TextAreaField
              label="Analysis prompt"
              value={settings.imageAnalysisPrompt}
              onChange={(v) => patch({ imageAnalysisPrompt: v })}
              disabled={pending}
            />
            <TextAreaField
              label="Sorting prompt"
              value={settings.imageSortingPrompt}
              onChange={(v) => patch({ imageSortingPrompt: v })}
              disabled={pending}
            />
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            The funnel is a chain and the Edge Function rejects a broken one, so
            lowering a collect value pulls its analyze cap and the gallery down
            with it. Winners mirror into the place-images bucket; the model is in
            §5.
          </p>
        </FunctionBlock>

        <FunctionBlock
          id="f-menu"
          index="7"
          flows="Enrich"
          name="Menu"
          blurb="Holds its slot so the number stays stable the day a real menu source lands."
        >
          <NoKnobs>
            No knobs, and nothing to configure — the website is not crawled, so
            no menu source exists. It always passes and can never block the
            queue.
          </NoKnobs>
        </FunctionBlock>

        <FunctionBlock
          id="f-reviews"
          index="8 · $$"
          flows="Enrich"
          name="Reviews"
          blurb="The newest Google reviews — what 9 · Description grounds the Presentation on."
        >
          <Fields>
            <NumberField
              icon={
                <MessageSquareQuote className="text-muted-foreground h-4 w-4" />
              }
              label="Google reviews to pull"
              value={settings.gatherReviews}
              min={0}
              max={100}
              onChange={(v) => patch({ gatherReviews: v })}
              disabled={pending}
            />
          </Fields>
          <p className="text-muted-foreground mt-3 text-xs">
            0–100, about $0.50 per 100. Mesita&apos;s own cost and wall-clock
            bound, not a Google one — the Places API itself returns 5.
          </p>
        </FunctionBlock>

        <FunctionBlock
          id="f-description"
          index="9 · $"
          flows="Enrich"
          name="Description"
          blurb="Closes the queue. Makes the Presentation, then Category, then Tags, in that order."
        >
          <KnobElsewhere>
            Its only knob is the <b>Text model</b> in §5 — the same setting drives
            the image-rank leg of 6 · Images, so it has one home.
          </KnobElsewhere>
        </FunctionBlock>

        <FunctionBlock
          id="f-summary"
          index="◇"
          flows="Create + Enrich"
          name="Summary"
          blurb="The 60-word text the index reads — never the prose a guest reads."
        >
          <NoKnobs>
            No knobs. The model is locked to <b>text-embedding-3-small</b>:
            swapping it re-embeds the whole catalog, so it is not a knob by
            design.
          </NoKnobs>
        </FunctionBlock>

        <FunctionBlock
          id="f-name"
          index="◇"
          flows="Create + Enrich"
          name="Name"
          blurb="The Mesita name as its own vector, so a search by name scores on the name."
        >
          <NoKnobs>
            Not built. The key is declared so this page can say &ldquo;not
            built&rdquo; about something real, and nothing stamps it.
          </NoKnobs>
        </FunctionBlock>

        {/* ══ 5 · MODELS & COST ══ */}
        <Band
          n="5"
          id="s-models"
          title="Models & cost"
          aside={<Tag tone="solid">shared, not a function</Tag>}
        />
        <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
          <p className="text-muted-foreground mb-4 max-w-3xl text-sm leading-relaxed">
            Each of these serves several functions, which is why none of them
            lives inside one. Embeddings is locked by design.
          </p>
          <Fields>
            <div className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
              <span className="text-sm font-medium">Text model</span>
              <QualityPicker
                value={settings.synthesisQuality}
                onChange={(v) => patch({ synthesisQuality: v })}
              />
              <span className="text-muted-foreground type-label">
                9 · Description and the image-rank leg of 6
              </span>
            </div>
            <div className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
              <span className="text-sm font-medium">Image model</span>
              <QualityPicker
                value={settings.visionQuality}
                onChange={(v) => patch({ visionQuality: v })}
              />
              <span className="text-muted-foreground type-label">
                6 · Images
              </span>
            </div>
            <SelectField
              label="Search model preset"
              hint="Agent X at 3 · Serp, Agent Y at 4 · Links"
              value={settings.perplexityPreset}
              options={PERPLEXITY_OPTIONS}
              onChange={(v) => patch({ perplexityPreset: v })}
              disabled={pending}
            />
            <NumberField
              icon={<Star className="text-muted-foreground h-4 w-4" />}
              label="Per-run cost cap (USD)"
              value={settings.perRunCostCapUsd}
              min={0}
              max={100}
              decimals
              onChange={(v) => patch({ perRunCostCapUsd: v })}
              disabled={pending}
            />
            <div className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
              <span className="text-sm font-medium">Embeddings</span>
              <span className="text-sm">text-embedding-3-small</span>
              <span className="text-muted-foreground type-label">
                locked · 1536-d · swapping it re-embeds the catalog
              </span>
            </div>
          </Fields>
          {settingsStamp && (
            <p className="text-muted-foreground mt-4 text-xs">
              Intaker settings last changed {formatShortDate(settingsStamp)}
            </p>
          )}
        </section>
      </div>

      {/* ══ ONE SAVE, hoisted ══ */}
      <div className="border-border bg-card/90 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            {blocked ? (
              <p className="text-destructive m-0 text-sm font-semibold">
                Save disabled — a config failed to load
              </p>
            ) : partial ? (
              <>
                <p className="text-destructive m-0 text-sm font-semibold">
                  {partial}
                </p>
                <p className="text-muted-foreground m-0 text-xs">
                  Only the half that failed is still unsaved — Save again to
                  retry just that half.
                </p>
              </>
            ) : dirty ? (
              <>
                <p className="m-0 text-sm font-semibold">
                  <span className="bg-primary mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  Unsaved changes
                </p>
                <p className="text-muted-foreground m-0 text-xs">
                  {dirtyNames.join(" · ")}
                </p>
              </>
            ) : ok ? (
              <p className="text-muted-foreground m-0 inline-flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </p>
            ) : (
              <p className="text-muted-foreground m-0 text-xs">
                {sourcingStamp
                  ? `Sourcing last changed ${formatShortDate(sourcingStamp)}`
                  : "Nothing to save"}
              </p>
            )}
          </div>
          <span className="flex-1" />
          <button
            type="button"
            onClick={discard}
            disabled={!dirty || pending}
            className="text-muted-foreground hover:text-foreground rounded-full px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending || !!blocked}
            className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-full px-6 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Intake"
            )}
          </button>
        </div>
        {error && (
          <div className="mx-auto max-w-5xl px-4 pb-3 sm:px-6">
            <ErrorNote message={error} />
          </div>
        )}
      </div>
    </>
  );
}
