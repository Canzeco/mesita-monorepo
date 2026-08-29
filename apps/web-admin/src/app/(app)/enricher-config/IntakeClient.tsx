"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  CheckCircle2,
  Facebook,
  Gauge,
  Globe,
  Instagram,
  ListOrdered,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import Link from "next/link";
import {
  Collapsible,
  NumberField,
  QualityPicker,
  SectionCard,
  TextAreaField,
} from "@/components/admin-ui/config";
import { chipsFor, flowTagFor } from "./intake-functions";
import {
  computeCreateCost,
  computeEnrichTickCost,
} from "./cost-model";
import { ImageFunnel } from "./ImageFunnel";
import { DISCOVERY_MAP_HREF } from "@/app/(app)/filters-config/nav";
import { updateAtlasConfig, type PerplexityPreset } from "./actions";
import {
  Fields,
  FlowEstimate,
  FlowPanel,
  FunctionModule,
  KnobElsewhere,
  NoKnobs,
  Tag,
} from "./blocks";
import { SectionStrip } from "./SectionStrip";
import { clampFunnel, intakeSaveBlocked, type IntakeSettings } from "./intake-guards";

export type { IntakeSettings };

// THE INTAKE PAGE. Four modules, Discovery-shaped. Models · Create ·
// Enrich · Functions. One page, no tabs. Search eligibility lives on
// Discovery › Map — not here.
//
// One Save, one write door (atlas_*). NO TRIGGER GRID.

const MAX_DISCOVERY_CANDIDATES = 10;

const PERPLEXITY_OPTIONS: readonly { value: PerplexityPreset; label: string }[] =
  [
    { value: "fast-search", label: "fast-search" },
    { value: "pro-search", label: "pro-search" },
    { value: "deep-research", label: "deep-research" },
    { value: "advanced-deep-research", label: "advanced-deep-research" },
  ];

export function IntakeClient({
  initialSettings,
  settingsUpdatedAt,
  settingsLoadError,
}: {
  initialSettings: IntakeSettings;
  settingsUpdatedAt: string | null;
  settingsLoadError: string | null;
}) {
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

  const blocked = intakeSaveBlocked(settingsLoadError);

  const patch = (next: Partial<IntakeSettings>) => {
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
        synthesisQuality: settings.synthesisQuality,
        visionQuality: settings.visionQuality,
        perplexityPreset: settings.perplexityPreset,
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

      <div className="flex flex-col gap-4 pb-24">
        <div id="s-models" className="scroll-mt-16">
          <SectionCard
            icon={<Gauge className="text-secondary h-4 w-4" />}
            title="Models"
            subtitle="Shared spend. Embeddings is locked."
          >
            <div className="mt-4">
              <ModelRow
                label="Text"
                hint="9 · Description, image-rank"
              >
                <QualityPicker
                  value={settings.synthesisQuality}
                  onChange={(v) => patch({ synthesisQuality: v })}
                />
              </ModelRow>
              <ModelRow label="Image" hint="6 · Images">
                <QualityPicker
                  value={settings.visionQuality}
                  onChange={(v) => patch({ visionQuality: v })}
                />
              </ModelRow>
              <ModelRow
                label="Search"
                hint="3 · Serp · 4 · Links"
              >
                <select
                  value={settings.perplexityPreset}
                  disabled={pending}
                  aria-label="Search model preset"
                  onChange={(e) =>
                    patch({
                      perplexityPreset: e.target.value as PerplexityPreset,
                    })
                  }
                  className="border-border bg-card focus:border-foreground h-8 w-full max-w-xs rounded-lg border px-2 text-xs font-semibold outline-none disabled:opacity-50"
                >
                  {PERPLEXITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </ModelRow>
              <ModelRow label="Embeddings" hint="locked · Semantic">
                <span className="text-sm">text-embedding-3-small</span>
              </ModelRow>
              {settingsStamp && (
                <p className="text-muted-foreground mt-3 text-xs">
                  Intaker settings last changed {formatShortDate(settingsStamp)}
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        <div id="s-create" className="scroll-mt-16">
          <SectionCard
            icon={<Sparkles className="text-secondary h-4 w-4" />}
            title="Create"
            subtitle="One function. It awaits four subfunctions."
            status={<Tag>$ · one Google call</Tag>}
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
                  caption="Pulse + Details + Semantic. One place."
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
                Consumer and admin Create mint the ugly profile and do not
                queue Intaker. Auto-enrich when this many guests vote on the
                Enrich tab. Admin Enrich and Create + Enrich skip the wait.
              </p>
            </div>
          </SectionCard>
        </div>

        <div id="s-enrich" className="scroll-mt-16">
          <SectionCard
            icon={<RefreshCw className="text-secondary h-4 w-4" />}
            title="Enrich"
            subtitle="Ten functions. One tick each — none await a nested run."
            status={<Tag>$$ · Apify · Firecrawl · Perplexity</Tag>}
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
                    "Infrastructure failure or permanently closed. Absence still reaches 10.",
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
            subtitle="Seed, then Enrich 1–10."
          >
            <div className="border-border mt-4 overflow-hidden rounded-xl border">
              <FunctionModule
                id="f-seed"
                index="·"
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
                id="f-pulse"
                index="1 · $"
                flows={flowTagFor("pulse")}
                name="Pulse"
                blurb="Is this place still alive."
                knobs="no knobs"
              >
                <NoKnobs>
                  No knobs. Google&apos;s <b>businessStatus</b> is the answer.
                </NoKnobs>
              </FunctionModule>

              <FunctionModule
                id="f-details"
                index="2 · $"
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
                index="3 · $"
                flows={flowTagFor("serp")}
                name="Serp"
                blurb="Editorial read Links spends to recognise the place. Never a fact source."
                knobs="in Models"
              >
                <KnobElsewhere>
                  The <b>Search model</b> in Models. Agent Y at Links reads the
                  same setting.
                </KnobElsewhere>
              </FunctionModule>

              <FunctionModule
                id="f-links"
                index="4 · $$"
                flows={flowTagFor("links")}
                name="Links"
                blurb="Firecrawl candidates, Agent Y picks one or none. Seed first, discover second."
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
              </FunctionModule>

              <FunctionModule
                id="f-social"
                index="5 · $$"
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
                id="f-menu"
                index="7"
                flows={flowTagFor("menu")}
                name="Menu"
                blurb="Holds the slot until a real menu source lands."
                knobs="no knobs"
              >
                <NoKnobs>No knobs. Always passes. Never blocks the queue.</NoKnobs>
              </FunctionModule>

              <FunctionModule
                id="f-reviews"
                index="8 · $$"
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
                id="f-description"
                index="9 · $"
                flows={flowTagFor("description")}
                name="Description"
                blurb="Category, Tags, Presentation."
                knobs="in Models"
              >
                <KnobElsewhere>
                  The <b>Text model</b> in Models. Same setting ranks images.
                </KnobElsewhere>
              </FunctionModule>
              <FunctionModule
                id="f-semantic"
                index="10 · $"
                flows={flowTagFor("semantic")}
                name="Semantic"
                blurb="Mesita Name & Semantic Summary & Embeddings. One function, two vectors. Closes Enrich at 10."
                knobs="locked"
              >
                <NoKnobs>
                  Locked to <b>text-embedding-3-small</b>. Name and Summary stay
                  two columns. One function writes both. Swapping the model
                  re-embeds the catalog.
                </NoKnobs>
              </FunctionModule>
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
            ) : dirty ? (
              <p className="m-0 text-sm font-semibold">
                <span className="bg-primary mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                Unsaved changes
              </p>
            ) : ok ? (
              <p className="text-muted-foreground m-0 inline-flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </p>
            ) : (
              <p className="text-muted-foreground m-0 text-xs">
                {settingsStamp
                  ? `Last changed ${formatShortDate(settingsStamp)}`
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

function ModelRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border grid grid-cols-1 items-center gap-2 border-t py-3 first:border-t-0 first:pt-0 sm:grid-cols-[6.5rem_minmax(12rem,20rem)_1fr] sm:gap-4">
      <span className="text-sm font-medium">{label}</span>
      <div className="min-w-0">{children}</div>
      <span className="text-muted-foreground type-label sm:text-right">
        {hint}
      </span>
    </div>
  );
}
