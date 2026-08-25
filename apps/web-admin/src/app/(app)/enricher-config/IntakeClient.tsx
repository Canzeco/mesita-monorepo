"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Facebook,
  Gauge,
  Globe,
  Image as ImageIcon,
  Instagram,
  Layers,
  ListOrdered,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  Collapsible,
  NumberField,
  QualityPicker,
  SectionCard,
  Switch,
  TextAreaField,
} from "@/components/admin-ui/config";
import { SourcingChannels } from "../sourcing-config/SourcingConfigClient";
import { updateSourcingConfig } from "../sourcing-config/actions";
import type { SourcingConfig } from "../sourcing-config/catalog";
import { chipsFor, flowTagFor } from "./intake-functions";
import { updateAtlasConfig, type PerplexityPreset } from "./actions";
import {
  Fields,
  FlowPanel,
  FunctionFamily,
  FunctionModule,
  KnobElsewhere,
  NoKnobs,
  SelectField,
  Tag,
} from "./blocks";
import { SectionStrip } from "./SectionStrip";
import {
  MAX_GOOGLE_COLLECT,
  MAX_INSTAGRAM_COLLECT,
  MAX_SAVE_IMAGES,
  clampFunnel,
  intakeSaveBlocked,
  type IntakeSettings,
} from "./intake-guards";

export type { IntakeSettings };

// THE INTAKE PAGE. Five modules, Discovery-shaped. Models sits FIRST (shared
// spend, above even Sourcing), then Sourcing · Create · Enrich · Functions.
// One page, no tabs. Functions are disclosure rows inside the Functions card,
// not a second stack of cards.
//
// ONE SAVE over TWO write doors — app_config.sourcing_config through
// admin-web-update-sourcing-config, and the atlas_* columns through
// admin-web-update-enricher-config. They are not one transaction, so the bar
// tells the truth about a half-landed write: sourcing first; if the second
// call fails the bar says which half landed and only the failed half stays dirty.
//
// NO TRIGGER GRID. What a run is allowed to buy lives in
// app_config.enrichment_triggers and is written by the EF alone (Pato, three
// times: 2026-08-21 "delete the triggers shit", 2026-08-23 "Fuck this page",
// 2026-08-23 "delete this stupid box"). Do not restore it as a fix.

const MAX_DISCOVERY_CANDIDATES = 10;

const PERPLEXITY_OPTIONS: readonly { value: PerplexityPreset; label: string }[] =
  [
    { value: "fast-search", label: "fast-search" },
    { value: "pro-search", label: "pro-search" },
    { value: "deep-research", label: "deep-research" },
    { value: "advanced-deep-research", label: "advanced-deep-research" },
  ];

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
  const blocked = intakeSaveBlocked(sourcingLoadError, settingsLoadError);

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
          return;
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

      <div className="space-y-6 pb-24">
        <div id="s-models" className="scroll-mt-16">
          <SectionCard
            icon={<Gauge className="text-secondary h-4 w-4" />}
            title="Models & cost"
            subtitle="Each of these serves several functions, which is why none of them lives inside one. Embeddings is locked by design."
            status={<Tag tone="solid">shared</Tag>}
          >
            <div className="mt-5">
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
            </div>
          </SectionCard>
        </div>

        <div id="s-sourcing" className="scroll-mt-16">
          <SectionCard
            icon={<Layers className="text-secondary h-4 w-4" />}
            title="Sourcing"
            subtitle="Who may find a place, who may add one, the Google floors each must clear, and one area for the whole gate."
            status={<Tag tone="solid">the gate</Tag>}
          >
            {sourcingLoadError ? (
              <div className="mt-4">
                <ErrorNote
                  message={`Sourcing failed to load: ${sourcingLoadError}`}
                />
              </div>
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
                framed={false}
              />
            )}
          </SectionCard>
        </div>

        <div id="s-create" className="scroll-mt-16">
          <SectionCard
            icon={<Sparkles className="text-secondary h-4 w-4" />}
            title="Create"
            subtitle="One run. Seed, then Pulse and Details inline; Name and Summary ride along. Synchronous, at the door — admin, business and consumer alike. The Intaker never calls it — a person or Memo does, by adding a place."
            status={<Tag>$ · one Google call</Tag>}
          >
            <FlowPanel
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
                      is refused <b>422</b> before any row exists.
                    </>
                  ),
                },
                {
                  term: "What it leaves behind",
                  detail:
                    "The paired place and project rows, the Google spine, a first photo, and a queued Summary vector. Pulse and details stamp, so a healthy fresh place reads Enriched 2/9 the moment it exists.",
                },
                {
                  term: "Then",
                  detail:
                    "It schedules the enrich queue — it never runs functions 3–9 inline.",
                },
              ]}
              steps={chipsFor("create")}
              footer="No knobs of its own. Everything Create does is a function below, and the semantic pair rides along outside the 0–9 count."
            />
          </SectionCard>
        </div>

        <div id="s-enrich" className="scroll-mt-16">
          <SectionCard
            icon={<RefreshCw className="text-secondary h-4 w-4" />}
            title="Enrich"
            subtitle="Sequential runs — one subfunction per cron tick, in order. Three cron Edge Functions over the place_research staging row: research runs 1·2·3·4·5·8, analysis runs 6, contents runs 7·9·◇summary."
            status={<Tag>$$ · Apify · Firecrawl · Perplexity</Tag>}
          >
            <FlowPanel
              facts={[
                {
                  term: "Cadence",
                  detail: (
                    <>
                      <code className="bg-muted rounded px-1 py-0.5 text-xs">
                        places.enrich_every_days
                      </code>
                      , set per place on the Place editor — not here. The queue
                      runs every 15 minutes and seeds at most <b>5 places per
                      tick, across all of Mesita</b>.
                    </>
                  ),
                },
                {
                  term: "What stops it",
                  detail:
                    "Infrastructure failure halts the queue, and so does a permanently-closed listing. Absence is a result, not a failure — a place with no Instagram still reaches 9. Spend is bounded by the collect and analyze knobs, and by five places per tick — not a dollar cap.",
                },
              ]}
              steps={chipsFor("enrich")}
              footer={
                <>
                  What a run is allowed to buy is not set here. That lives in{" "}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    app_config.enrichment_triggers
                  </code>
                  , written by the enricher-config Edge Function. Two events fire
                  today: the run Create schedules, and the per-place decay
                  refresh.
                </>
              }
            />
          </SectionCard>
        </div>

        <div id="s-functions" className="scroll-mt-16">
          <SectionCard
            icon={<ListOrdered className="text-secondary h-4 w-4" />}
            title="The functions"
            subtitle="12 subfunctions, listed once. Create is one run. Enrich is sequential runs. Each card says which function uses it. Name and Summary have no number and enriched never counts them."
            status={<Tag tone="solid">12 modules · 15 knobs</Tag>}
          >
            <div className="mt-2">
              <FunctionFamily
                tone="create"
                label="Create"
                kicker="One run. Seed, Pulse, Details, then Name and Summary ride along."
                note="Pulse, Details, Name and Summary are the same subfunctions Enrich uses. They are not a second ladder."
                chips={chipsFor("create")}
              />
              <FunctionFamily
                tone="enrich"
                label="Enrich"
                kicker="Sequential runs — one subfunction per cron tick, in this order. Name and Summary ride along. enriched is the nine, not the pair."
                note="Seed is Create-only. 3–9 are Enrich-only. Shared rows print once below."
                chips={chipsFor("enrich")}
              />
              <div className="border-border bg-card mt-4 overflow-hidden rounded-xl border">
              <FunctionModule
                id="f-seed"
                index="SEED"
                name="Seed"
                flows={flowTagFor("seed")}
                blurb="Dedupe on the Google Place ID and mint the paired rows at category='undefined'."
                knobs="no knobs"
              >
                <NoKnobs>
                  No knobs. The row existing <b>is</b> the seed, which is why it
                  is not an enrich function and never gets stamped.
                </NoKnobs>
              </FunctionModule>

              <FunctionModule
                id="f-pulse"
                index="1 · $"
                flows={flowTagFor("pulse")}
                name="Pulse"
                blurb="One question: is this place still alive. Not the hours, not the address."
                knobs="no knobs"
              >
                <NoKnobs>
                  No knobs. Google&apos;s <b>businessStatus</b> is the answer and
                  it is not tunable. It runs before the cost ledger opens.
                </NoKnobs>
              </FunctionModule>

              <FunctionModule
                id="f-details"
                index="2 · $"
                flows={flowTagFor("details")}
                name="Details"
                blurb="The Google spine: hours, address, geo, zone, city, timezone, price, phone, and the name."
                knobs="no knobs"
              >
                <NoKnobs>
                  No knobs. Every field here is a fact Google states. The one
                  override is <b>mesita_name</b>, owned by a human on the Place
                  editor — enrichment never touches it.
                </NoKnobs>
              </FunctionModule>
              <FunctionModule
                id="f-serp"
                index="3 · $"
                flows={flowTagFor("serp")}
                name="Serp"
                blurb="Agent X writes the editorial read that Links spends to recognise the place. Never a source of facts."
                knobs="in Models"
              >
                <KnobElsewhere>
                  Its only knob is the <b>Search model preset</b> in Models — one
                  value with one home, because Agent Y at 4 · Links reads the
                  same setting.
                </KnobElsewhere>
              </FunctionModule>

              <FunctionModule
                id="f-links"
                index="4 · $$"
                flows={flowTagFor("links")}
                name="Links"
                blurb="Firecrawl gathers candidates per source, Agent Y picks one or none. Seed first, discover second."
                knobs="5 knobs"
                defaultOpen
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
                    icon={
                      <Instagram className="text-muted-foreground h-4 w-4" />
                    }
                    label="Instagram candidates"
                    value={settings.discoverInstagramN}
                    min={0}
                    max={MAX_DISCOVERY_CANDIDATES}
                    onChange={(v) => patch({ discoverInstagramN: v })}
                    disabled={pending}
                  />
                  <NumberField
                    icon={
                      <Facebook className="text-muted-foreground h-4 w-4" />
                    }
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
                    icon={
                      <ShoppingBag className="text-muted-foreground h-4 w-4" />
                    }
                    label="Uber Eats candidates"
                    value={settings.discoverUbereatsN}
                    min={0}
                    max={MAX_DISCOVERY_CANDIDATES}
                    onChange={(v) => patch({ discoverUbereatsN: v })}
                    disabled={pending}
                  />
                </Fields>
                <p className="text-muted-foreground mt-3 text-xs">
                  0 turns a source off. A channel the Google spine already
                  supplied at create is trusted as-is — discovery runs only for
                  what is missing.
                </p>
              </FunctionModule>

              <FunctionModule
                id="f-social"
                index="5 · $$"
                flows={flowTagFor("social")}
                name="Social"
                blurb="The Instagram and Facebook profiles — handle, followers, bio. It does not collect posts."
                knobs="no knobs"
              >
                <NoKnobs>
                  No knobs. Social attaches the accounts Links resolved. Post
                  images are an Images job: that function collects them from
                  Apify and then analyzes them, which is why the collect knob
                  lives there.
                </NoKnobs>
              </FunctionModule>

              <FunctionModule
                id="f-images"
                index="6 · $$"
                flows={flowTagFor("images")}
                name="Images"
                blurb="Collects images from Apify, then describes and ranks them. Largest cost driver here."
                knobs="7 knobs"
                defaultOpen
              >
                <Fields>
                  <NumberField
                    icon={
                      <ImageIcon className="text-muted-foreground h-4 w-4" />
                    }
                    label="Google photos to collect"
                    value={settings.gatherGoogleImages}
                    min={1}
                    max={MAX_GOOGLE_COLLECT}
                    onChange={(v) => patch({ gatherGoogleImages: v })}
                    disabled={pending}
                  />
                  <NumberField
                    icon={
                      <Instagram className="text-muted-foreground h-4 w-4" />
                    }
                    label="Instagram posts to collect"
                    value={settings.gatherInstagramDepth}
                    min={1}
                    max={MAX_INSTAGRAM_COLLECT}
                    onChange={(v) => patch({ gatherInstagramDepth: v })}
                    disabled={pending}
                  />
                  <NumberField
                    icon={
                      <ImageIcon className="text-muted-foreground h-4 w-4" />
                    }
                    label="Analyze Google (≤ collected)"
                    value={settings.analyzeGoogleImages}
                    min={1}
                    max={settings.gatherGoogleImages}
                    onChange={(v) => patch({ analyzeGoogleImages: v })}
                    disabled={pending || !settings.imageVisionEnabled}
                  />
                  <NumberField
                    icon={
                      <Instagram className="text-muted-foreground h-4 w-4" />
                    }
                    label="Analyze Instagram (≤ collected)"
                    value={settings.analyzeInstagramImages}
                    min={1}
                    max={settings.gatherInstagramDepth}
                    onChange={(v) => patch({ analyzeInstagramImages: v })}
                    disabled={pending || !settings.imageVisionEnabled}
                  />
                  <NumberField
                    icon={
                      <ImageIcon className="text-muted-foreground h-4 w-4" />
                    }
                    label="Photos kept on the profile"
                    value={settings.saveTotalImages}
                    min={1}
                    max={Math.min(
                      MAX_SAVE_IMAGES,
                      settings.analyzeGoogleImages +
                        settings.analyzeInstagramImages,
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
                        patch({
                          imageVisionEnabled: !settings.imageVisionEnabled,
                        })
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
                        patch({
                          saveImagesToStorage: !settings.saveImagesToStorage,
                        })
                      }
                    />
                  </div>
                </Fields>
                <Collapsible summary="Analysis & sorting prompts">
                  <div className="grid gap-4 lg:grid-cols-2">
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
                </Collapsible>
                <p className="text-muted-foreground mt-3 text-xs">
                  Instagram posts: newest first, then top-K by likes. The funnel
                  is a chain and the Edge Function rejects a broken one, so
                  lowering a collect value pulls its analyze cap and the gallery
                  down with it. Winners mirror into the place-images bucket; the
                  model is in Models.
                </p>
              </FunctionModule>

              <FunctionModule
                id="f-menu"
                index="7"
                flows={flowTagFor("menu")}
                name="Menu"
                blurb="Holds its slot so the number stays stable the day a real menu source lands."
                knobs="no knobs"
              >
                <NoKnobs>
                  No knobs, and nothing to configure — the website is not
                  crawled, so no menu source exists. It always passes and can
                  never block the queue.
                </NoKnobs>
              </FunctionModule>

              <FunctionModule
                id="f-reviews"
                index="8 · $$"
                flows={flowTagFor("reviews")}
                name="Reviews"
                blurb="The newest Google reviews — what 9 · Description grounds the Presentation on."
                knobs="1 knob"
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
                  0–100, about $0.50 per 100. Mesita&apos;s own cost and
                  wall-clock bound, not a Google one — the Places API itself
                  returns 5.
                </p>
              </FunctionModule>

              <FunctionModule
                id="f-description"
                index="9 · $"
                flows={flowTagFor("description")}
                name="Description"
                blurb="Closes the queue. Makes the Presentation, then Category, then Tags, in that order."
                knobs="in Models"
              >
                <KnobElsewhere>
                  Its only knob is the <b>Text model</b> in Models — the same
                  setting drives the image-rank leg of 6 · Images, so it has one
                  home.
                </KnobElsewhere>
              </FunctionModule>
              <FunctionModule
                id="f-name"
                index="◇"
                flows={flowTagFor("name")}
                name="Name"
                blurb="The Mesita name as its own vector, so a search by name scores on the name."
                knobs="not built"
              >
                <NoKnobs>
                  Not built. The key is declared so this page can say
                  &ldquo;not built&rdquo; about something real, and nothing
                  stamps it.
                </NoKnobs>
              </FunctionModule>

              <FunctionModule
                id="f-summary"
                index="◇"
                flows={flowTagFor("summary")}
                name="Summary"
                blurb="The 60-word text the index reads — never the prose a guest reads."
                knobs="locked"
              >
                <NoKnobs>
                  No knobs. The model is locked to <b>text-embedding-3-small</b>:
                  swapping it re-embeds the whole catalog, so it is not a knob by
                  design.
                </NoKnobs>
              </FunctionModule>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

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
