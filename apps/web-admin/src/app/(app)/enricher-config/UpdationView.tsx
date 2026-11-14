"use client";

// UPDATION (MESITA-3939): three cards, one anatomy, cheapest first.
//   Fast Update · Deep Update · Deep Enrich
// Each card says who it runs on, what it costs, what it refreshes and, with
// its own two numbers, when it runs. Deep Enrich also holds the ladder's
// steps (each row id f-<key>, so Creation's chips land on it) and the
// settings those steps read. Links inside the page are plain <a>: a
// same-route next/link updates the hash without a hashchange, and the
// settings groups open on hashchange.

import { Facebook, Instagram } from "@/components/shared/SocialIcons";
import {
  Globe,
  Layers,
  RefreshCw,
  ShoppingBag,
  Star,
  Zap,
} from "lucide-react";
import {
  Collapsible,
  NumberField,
  SectionCard,
  TextAreaField,
} from "@/components/admin-ui/config";
import type { CrenupPrompt } from "./actions";
import {
  Fields,
  FlowEstimate,
  KnobElsewhere,
  PromptDisclosure,
  Tag,
} from "./blocks";
import type { CostEstimate } from "./cost-model";
import type { CrenupSettings } from "./crenup-guards";
import {
  CRENUP_STEP_SPECS,
  STEP_SETTINGS,
  UPDATION_LEVELS,
  viewsLine,
  type UpdationLevel,
  type UpdationLevelId,
} from "./crenup-steps";
import { ImageFunnel } from "./ImageFunnel";

const MAX_DISCOVERY_CANDIDATES = 10;

const ICON: Record<UpdationLevelId, React.ReactNode> = {
  "fast-update": <Zap className="text-secondary h-4 w-4" />,
  "deep-update": <RefreshCw className="text-secondary h-4 w-4" />,
  "deep-enrich": <Layers className="text-secondary h-4 w-4" />,
};

const SECTION_ID: Record<UpdationLevelId, string> = {
  "fast-update": "s-fast-update",
  "deep-update": "s-deep-update",
  "deep-enrich": "s-enrich",
};

type Patch = (next: Partial<CrenupSettings>) => void;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground type-meta mb-2 font-semibold tracking-wider uppercase">
      {children}
    </p>
  );
}

/** The level's two numbers and the views they make. */
function Schedule({
  level,
  first,
  every,
  firstMin,
  firstMax,
  onFirst,
  onEvery,
  disabled,
}: {
  level: UpdationLevelId;
  first: number;
  every: number;
  firstMin: number;
  firstMax: number;
  onFirst: (v: number) => void;
  onEvery: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="border-border mt-5 border-t pt-5">
      <Label>When it runs</Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="First after N views"
          value={first}
          min={firstMin}
          max={firstMax}
          onChange={onFirst}
          disabled={disabled}
        />
        <NumberField
          label="Then every M views"
          value={every}
          min={0}
          max={1000}
          onChange={onEvery}
          disabled={disabled}
        />
      </div>
      <p className="mt-3 text-sm font-medium">{viewsLine(level, first, every)}</p>
    </div>
  );
}

function LevelCard({
  level,
  children,
}: {
  level: UpdationLevel;
  children: React.ReactNode;
}) {
  return (
    <div id={SECTION_ID[level.id]} className="scroll-mt-16">
      <SectionCard
        icon={ICON[level.id]}
        title={level.title}
        subtitle={level.purpose}
        state={
          <div className="flex flex-wrap gap-1.5">
            <Tag tone="solid">{level.runsOn}</Tag>
            <Tag>{level.cost}</Tag>
          </div>
        }
      >
        {level.refreshes.length > 0 && (
          <div className="mt-5">
            <Label>Refreshes</Label>
            <div className="flex flex-wrap gap-1.5">
              {level.refreshes.map((r) => (
                <Tag key={r}>{r}</Tag>
              ))}
            </div>
            {level.neverTouches && (
              <p className="text-muted-foreground mt-3 text-sm">
                Never touches {level.neverTouches}.
              </p>
            )}
            {level.keepsEdits && (
              <p className="text-muted-foreground mt-1 text-sm">
                Keeps edits a person made; never blanks a filled field.
              </p>
            )}
          </div>
        )}
        {children}
      </SectionCard>
    </div>
  );
}

/** Deep Enrich's steps 1-8. Each row is a link target for Creation's chips. */
function Steps() {
  const steps = CRENUP_STEP_SPECS.filter((s) => s.flows.includes("enrich"));
  return (
    <div className="mt-5">
      <Label>Steps</Label>
      <ol className="border-border divide-border divide-y overflow-hidden rounded-xl border">
        {steps.map((s) => {
          const settings = STEP_SETTINGS[s.key];
          return (
            <li
              key={s.key}
              id={s.id}
              className="flex scroll-mt-16 items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span>
                <span className="text-muted-foreground mr-2 font-mono tabular-nums">{s.number}</span>
                {s.name}
              </span>
              {settings && (
                <a
                  href={settings.href}
                  className="text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline"
                >
                  {settings.label} ›
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function UpdationView({
  settings,
  patch,
  pending,
  blocked,
  prompts,
  enrichCost,
}: {
  settings: CrenupSettings;
  patch: Patch;
  pending: boolean;
  blocked: boolean;
  prompts: CrenupPrompt[];
  enrichCost: CostEstimate;
}) {
  const promptFor = (key: string) => prompts.find((p) => p.key === key);
  const off = pending || blocked;
  const [fast, deep, enrich] = UPDATION_LEVELS;

  return (
    <>
      <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
        A view is a different guest opening a place&apos;s profile; each guest counts once per
        place. For Fast Update and Deep Update, first after 0 turns the level off. Then every 0
        runs a level once.
      </p>

      <LevelCard level={fast}>
        <Schedule
          level="fast-update"
          first={settings.updateFirstAfterViews}
          every={settings.updateEveryViews}
          firstMin={0}
          firstMax={1000}
          onFirst={(v) => patch({ updateFirstAfterViews: v })}
          onEvery={(v) => patch({ updateEveryViews: v })}
          disabled={off}
        />
      </LevelCard>

      <LevelCard level={deep}>
        <Schedule
          level="deep-update"
          first={settings.reviewsUpdateFirstAfterViews}
          every={settings.reviewsUpdateEveryViews}
          firstMin={0}
          firstMax={1000}
          onFirst={(v) => patch({ reviewsUpdateFirstAfterViews: v })}
          onEvery={(v) => patch({ reviewsUpdateEveryViews: v })}
          disabled={off}
        />
      </LevelCard>

      <LevelCard level={enrich}>
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          {/* When it stops: render/src/enrich.ts (Google spine, the closed
              halt, and a missing description throw; other steps are stamped). */}
          <div className="text-muted-foreground space-y-1 text-sm leading-relaxed">
            <p>Also runs from admin Enrich; a wrong-number call refetches Google.</p>
            <p>
              Stops if Google fails, the place is closed for good, or no description can be
              written; other failed steps are marked and the profile still saves.
            </p>
          </div>
          <FlowEstimate caption="Settings below. One place." estimate={enrichCost} />
        </div>

        <Schedule
          level="deep-enrich"
          first={settings.requestThreshold}
          every={settings.enrichEveryViews}
          firstMin={1}
          firstMax={100}
          onFirst={(v) => patch({ requestThreshold: v })}
          onEvery={(v) => patch({ enrichEveryViews: v })}
          disabled={off}
        />

        <Steps />

        <div className="border-border mt-5 border-t pt-1">
          <Collapsible id="k-links" summary="Links" defaultOpen>
            <Fields>
              <NumberField
                icon={<Globe className="text-muted-foreground h-4 w-4" />}
                label="Website candidates"
                value={settings.discoverWebsiteN}
                min={0}
                max={MAX_DISCOVERY_CANDIDATES}
                onChange={(v) => patch({ discoverWebsiteN: v })}
                disabled={off}
              />
              <NumberField
                icon={<Instagram className="text-muted-foreground h-4 w-4" />}
                label="Instagram candidates"
                value={settings.discoverInstagramN}
                min={0}
                max={MAX_DISCOVERY_CANDIDATES}
                onChange={(v) => patch({ discoverInstagramN: v })}
                disabled={off}
              />
              <NumberField
                icon={<Facebook className="text-muted-foreground h-4 w-4" />}
                label="Facebook candidates"
                value={settings.discoverFacebookN}
                min={0}
                max={MAX_DISCOVERY_CANDIDATES}
                onChange={(v) => patch({ discoverFacebookN: v })}
                disabled={off}
              />
              <NumberField
                icon={<Star className="text-muted-foreground h-4 w-4" />}
                label="OpenTable candidates"
                value={settings.discoverOpentableN}
                min={0}
                max={MAX_DISCOVERY_CANDIDATES}
                onChange={(v) => patch({ discoverOpentableN: v })}
                disabled={off}
              />
              <NumberField
                icon={<ShoppingBag className="text-muted-foreground h-4 w-4" />}
                label="Uber Eats candidates"
                value={settings.discoverUbereatsN}
                min={0}
                max={MAX_DISCOVERY_CANDIDATES}
                onChange={(v) => patch({ discoverUbereatsN: v })}
                disabled={off}
              />
            </Fields>
            <p className="text-muted-foreground mt-3 text-sm">
              0 turns a source off. A link Google already lists is not searched for.
            </p>
            <PromptDisclosure prompt={promptFor("resolver")} preset={settings.perplexityPreset} />
          </Collapsible>

          <p id="k-reviews" className="text-muted-foreground mt-5 scroll-mt-16 text-sm">
            <span className="font-medium">Reviews</span> · the 100 newest Google reviews, fixed.
          </p>

          <Collapsible id="k-images" summary="Images" defaultOpen>
            <ImageFunnel settings={settings} pending={off} onPatch={patch} />
            <Collapsible summary="Analysis and sorting prompts">
              <div className="grid gap-4 lg:grid-cols-2">
                <TextAreaField
                  label="Analysis prompt"
                  value={settings.imageAnalysisPrompt}
                  onChange={(v) => patch({ imageAnalysisPrompt: v })}
                  disabled={off}
                />
                <TextAreaField
                  label="Sorting prompt"
                  value={settings.imageSortingPrompt}
                  onChange={(v) => patch({ imageSortingPrompt: v })}
                  disabled={off}
                />
              </div>
            </Collapsible>
          </Collapsible>

          <Collapsible id="k-models" summary="Models and prompts">
            <div className="space-y-2">
              <KnobElsewhere>
                Research uses the <b>Search model</b> and descriptions the <b>Text model</b>, both
                set in Models. Vectors are locked to <b>text-embedding-3-small</b>.
              </KnobElsewhere>
            </div>
            <PromptDisclosure prompt={promptFor("scout")} preset={settings.perplexityPreset} />
            <PromptDisclosure prompt={promptFor("presentation")} />
            <PromptDisclosure prompt={promptFor("category")} />
            <PromptDisclosure prompt={promptFor("family")} />
          </Collapsible>
        </div>
      </LevelCard>
    </>
  );
}
