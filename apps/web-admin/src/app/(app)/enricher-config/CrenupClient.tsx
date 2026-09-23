"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Facebook,
  Gauge,
  Globe,
  Instagram,
  ListOrdered,
  MessageSquareQuote,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { formatShortDate } from "@/lib/format";
import Link from "next/link";
import {
  Collapsible,
  NumberField,
  SectionCard,
  TextAreaField,
} from "@/components/admin-ui/config";
import { chipsFor, flowTagFor } from "./crenup-steps";
import {
  computeCreateCost,
  computeEnrichTickCost,
} from "./cost-model";
import { ImageFunnel } from "./ImageFunnel";
import { DISCOVERY_MAP_HREF } from "@/app/(app)/filters-config/nav";
import {
  updateAtlasConfig,
  type CrenupPrompt,
} from "./actions";
import {
  Fields,
  FlowEstimate,
  FlowPanel,
  FunctionModule,
  KnobElsewhere,
  ModelRow,
  NoKnobs,
  PromptDisclosure,
  Tag,
} from "./blocks";
import { CrenupSaveBar } from "./CrenupSaveBar";
import { SectionStrip } from "./SectionStrip";
import { clampFunnel, type CrenupSettings } from "./crenup-guards";
import { MODELS_PARENT } from "../models-config/nav";
import {
  VerificationConfigClient,
} from "../verification-config/VerificationConfigClient";
import type { VerificationConfig } from "../verification-config/defaults";

/** The Crenup box on Manage Places — where Create actually runs. */
const CRENUP_BOX_HREF = "/manage-multiple#crenup";

export type { CrenupSettings };

// THE CRENUP PAGE. Models (read-only) · Create · Enrich · Functions · Verification.
// Discovery-shaped. One Crenup Save for atlas_*; Verification keeps its own
// per-switch save. Search eligibility lives on Discovery › Map — not here.

const MAX_DISCOVERY_CANDIDATES = 10;

const QUALITY_LABEL: Record<CrenupSettings["synthesisQuality"], string> = {
  economy: "economy",
  standard: "standard",
  high: "high",
};

export function CrenupClient({
  initialSettings,
  settingsUpdatedAt,
  settingsLoadError,
  prompts,
  verificationConfig,
  verificationUpdatedAt,
  verificationLoadError,
}: {
  initialSettings: CrenupSettings;
  settingsUpdatedAt: string | null;
  settingsLoadError: string | null;
  /**
   * What each model is TOLD, straight from the backend. Read-only, and empty
   * when the GET failed — a prompt disclosure that invents its own text would
   * be worse than an absent one.
   */
  prompts: CrenupPrompt[];
  verificationConfig: VerificationConfig;
  verificationUpdatedAt: string | null;
  verificationLoadError: string | null;
}) {
  const promptFor = (key: string) => prompts.find((p) => p.key === key);
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [settingsStamp, setSettingsStamp] = useState(settingsUpdatedAt);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings],
  );

  // A failed GET disables Save — defaults must not overwrite live (MESITA-737).
  const blocked = settingsLoadError;

  const patch = (next: Partial<CrenupSettings>) => {
    setSettings((s) => clampFunnel({ ...s, ...next }));
    setOk(false);
  };

  const save = () => {
    if (blocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateAtlasConfig({
        gatherGoogleImages: settings.gatherGoogleImages,
        gatherInstagramDepth: settings.gatherInstagramDepth,
        gatherInstagramPosts: settings.analyzeInstagramImages,
        gatherReviews: settings.gatherReviews,
        imageVisionEnabled: settings.imageVisionEnabled,
        saveImagesToStorage: settings.saveImagesToStorage,
        saveTotalImages: settings.saveTotalImages,
        analyzeGoogleImages: settings.analyzeGoogleImages,
        analyzeInstagramImages: settings.analyzeInstagramImages,
        imageAnalysisPrompt: settings.imageAnalysisPrompt,
        imageSortingPrompt: settings.imageSortingPrompt,
        discoverWebsiteN: settings.discoverWebsiteN,
        discoverInstagramN: settings.discoverInstagramN,
        discoverFacebookN: settings.discoverFacebookN,
        discoverOpentableN: settings.discoverOpentableN,
        discoverUbereatsN: settings.discoverUbereatsN,
        requestThreshold: settings.requestThreshold,
      });
      if (r.ok) {
        setSavedSettings(settings);
        setSettingsStamp(r.data.updatedAt);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  const discard = () => {
    setSettings(savedSettings);
    setError(null);
    setOk(false);
  };

  const createCost = useMemo(() => computeCreateCost(settings), [settings]);
  const enrichCost = useMemo(
    () => computeEnrichTickCost(settings),
    [settings],
  );

  return (
    <>
      <SectionStrip />

      {/* pb-24 keeps the last module clear of the sticky CrenupSaveBar. */}
      <div className="flex flex-col gap-4 pb-24">
        <div id="s-models" className="scroll-mt-16">
          <SectionCard
            icon={<Gauge className="text-secondary h-4 w-4" />}
            title="Models"
            subtitle="Read-only reference — configure on Models."
          >
            <div className="mt-4">
              <ModelRow
                label="Text"
                hint="9 · Description, image-rank"
              >
                <span className="text-sm font-medium">
                  {QUALITY_LABEL[settings.synthesisQuality]}
                </span>
              </ModelRow>
              <ModelRow label="Image" hint="6 · Images">
                <span className="text-sm font-medium">
                  {QUALITY_LABEL[settings.visionQuality]}
                </span>
              </ModelRow>
              <ModelRow
                label="Search"
                hint="3 · Serp · 4 · Links"
              >
                <span className="text-sm font-medium">
                  {settings.perplexityPreset}
                </span>
              </ModelRow>
              <ModelRow label="Embeddings" hint="locked · Embedding">
                <span className="text-sm">text-embedding-3-small</span>
              </ModelRow>
              <p className="text-muted-foreground mt-3 text-sm">
                <Link
                  href={MODELS_PARENT.href}
                  className="text-foreground font-semibold underline underline-offset-2"
                >
                  Configure on Models ›
                </Link>
              </p>
              {settingsStamp && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Enricher settings last changed {formatShortDate(settingsStamp)}
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        <div id="s-create" className="scroll-mt-16">
          <SectionCard
            icon={<Sparkles className="text-secondary h-4 w-4" />}
            title="Create"
            subtitle="One function. It awaits steps 0, 1, 7 and 8."
            state={<Tag>$ · one Google call</Tag>}
          >
            <FlowPanel
              facts={[
                {
                  term: "Starts",
                  detail: (
                    <>
                      A person or Memo adds a place.{" "}
                      <Link
                        href={DISCOVERY_MAP_HREF}
                        className="text-foreground underline underline-offset-2"
                      >
                        Discovery › Map
                      </Link>{" "}
                      decides whether the add is allowed.
                    </>
                  ),
                },
                {
                  term: "Stops",
                  detail: (
                    <>
                      Google{" "}
                      <code className="bg-muted rounded px-1 py-0.5 text-xs">
                        CLOSED_PERMANENTLY
                      </code>{" "}
                      is refused 422 before any row exists.
                    </>
                  ),
                },
              ]}
              steps={chipsFor("create")}
              estimate={
                <FlowEstimate
                  caption="Details + Description + Embedding. One place."
                  estimate={createCost}
                />
              }
            />
            <div className="mt-4">
              <Fields>
                <NumberField
                  icon={<Users className="text-muted-foreground h-4 w-4" />}
                  label="Vote threshold"
                  value={settings.requestThreshold}
                  min={1}
                  max={100}
                  onChange={(v) => patch({ requestThreshold: v })}
                  disabled={pending}
                />
              </Fields>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Create mints the ugly profile without queuing the Enricher.
                Auto-enrich after this many Enrich-tab votes. Admin Enrich skips
                the wait.
              </p>
              {/* This page CONFIGURES Create; it does not run it. The door is
                  Manage Places, same idiom as the Models section's jump. */}
              <p className="text-muted-foreground mt-3 text-sm">
                <Link
                  href={CRENUP_BOX_HREF}
                  className="text-foreground font-semibold underline underline-offset-2"
                >
                  Create a place ›
                </Link>
              </p>
            </div>
          </SectionCard>
        </div>

        <div id="s-enrich" className="scroll-mt-16">
          <SectionCard
            icon={<RefreshCw className="text-secondary h-4 w-4" />}
            title="Enrich"
            subtitle="Eight steps. One tick each — none await a nested run."
            state={<Tag>$$ · Apify · Firecrawl · Perplexity</Tag>}
          >
            <FlowPanel
              facts={[
                {
                  term: "Cadence",
                  detail:
                    "Place editor sets the days. Queue every 15 minutes, five places per tick.",
                },
                {
                  term: "Stops",
                  detail:
                    "Infrastructure failure or permanently closed. Absence still reaches 8.",
                },
              ]}
              steps={chipsFor("enrich")}
              estimate={
                <FlowEstimate
                  caption="Knobs below. One place."
                  estimate={enrichCost}
                />
              }
            />
          </SectionCard>
        </div>

        <div id="s-functions" className="scroll-mt-16">
          <SectionCard
            icon={<ListOrdered className="text-secondary h-4 w-4" />}
            title="Functions"
            subtitle="One ladder: Seed at 0, then 1–8."
          >
            <div className="border-border mt-4 overflow-hidden rounded-xl border">
              <FunctionModule
                id="f-seed"
                index="0"
                name="Seed"
                flows={flowTagFor("seed")}
                blurb="Dedupe on the Google Place ID and mint the paired rows. The row existing is the seed."
                knobs="no knobs"
              >
                <NoKnobs>
                  No knobs. The row existing is the seed. It is never stamped.
                </NoKnobs>
              </FunctionModule>

              <FunctionModule
                id="f-details"
                index="1 · $"
                flows={flowTagFor("details")}
                name="Details"
                blurb="Hours, address, geo, timezone, price, phone, and the name."
                knobs="no knobs"
              >
                <NoKnobs>
                  No knobs. Facts Google states. <b>mesita_name</b> is the Place
                  editor override.
                </NoKnobs>
              </FunctionModule>
              <FunctionModule
                id="f-serp"
                index="2 · $"
                flows={flowTagFor("serp")}
                name="Serp"
                blurb="Editorial read Links spends to recognise the place. Never a fact source."
                knobs="in Models"
              >
                <KnobElsewhere>
                  The <b>Search model</b> in Models. The Resolver at Links reads the
                  same setting.
                </KnobElsewhere>
                <PromptDisclosure
                  prompt={promptFor("scout")}
                  preset={settings.perplexityPreset}
                />
              </FunctionModule>

              <FunctionModule
                id="f-links"
                index="3 · $$"
                flows={flowTagFor("links")}
                name="Links"
                blurb="Firecrawl candidates, the Resolver picks one or none. Seed first, discover second."
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
                  0 turns a source off. Google-seeded channels skip discovery.
                </p>
                <PromptDisclosure
                  prompt={promptFor("resolver")}
                  preset={settings.perplexityPreset}
                />
              </FunctionModule>

              <FunctionModule
                id="f-social"
                index="4 · $$"
                flows={flowTagFor("social")}
                name="Social"
                blurb="Instagram and Facebook profiles. Does not collect posts."
                knobs="no knobs"
              >
                <NoKnobs>
                  No knobs. Posts are an Images job.
                </NoKnobs>
              </FunctionModule>

              <FunctionModule
                id="f-reviews"
                index="5 · $$"
                flows={flowTagFor("reviews")}
                name="Reviews"
                blurb="Newest Google reviews. Description grounds the Presentation on these."
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
                  0–100. Places API itself returns 5.
                </p>
              </FunctionModule>

              <FunctionModule
                id="f-images"
                index="6 · $$"
                flows={flowTagFor("images")}
                name="Images"
                blurb="Instagram: last X newest, rank by likes, vision top Y. Google is already ranked."
                knobs="2 funnels"
                defaultOpen
              >
                <ImageFunnel
                  settings={settings}
                  pending={pending}
                  onPatch={patch}
                />
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
                  Lowering last/take pulls vision and the gallery with it. The
                  model is in Models.
                </p>
              </FunctionModule>

              <FunctionModule
                id="f-description"
                index="7 · $"
                flows={flowTagFor("description")}
                name="Description"
                blurb="Family · Category · Tags · Presentation · Orders Enabled · Reservations Enabled · Mesita Name · Semantic Summary."
                knobs="in Models"
              >
                <KnobElsewhere>
                  The <b>Text model</b> in Models. Same setting ranks images.
                </KnobElsewhere>
                <PromptDisclosure prompt={promptFor("presentation")} />
                <PromptDisclosure prompt={promptFor("category")} />
                <PromptDisclosure prompt={promptFor("family")} />
              </FunctionModule>
              <FunctionModule
                id="f-embedding"
                index="8 · $"
                flows={flowTagFor("embedding")}
                name="Embedding"
                blurb="Mesita Name Embedding · Semantic Summary Embedding. Two vectors, one function. Closes Enrich at 10."
                knobs="locked"
              >
                <NoKnobs>
                  Locked to <b>text-embedding-3-small</b>. It only embeds what
                  Description wrote — never synthesizes text. One function
                  writes both vectors. Swapping the model re-embeds the
                  catalog.
                </NoKnobs>
              </FunctionModule>
            </div>
          </SectionCard>
        </div>

        <div id="s-verification" className="scroll-mt-16">
          <VerificationConfigClient
            initialConfig={verificationConfig}
            initialUpdatedAt={verificationUpdatedAt}
            loadError={verificationLoadError}
          />
        </div>
      </div>

      <CrenupSaveBar
        blocked={blocked}
        dirty={dirty}
        ok={ok}
        pending={pending}
        settingsStamp={settingsStamp}
        error={error}
        onDiscard={discard}
        onSave={save}
      />
    </>
  );
}
