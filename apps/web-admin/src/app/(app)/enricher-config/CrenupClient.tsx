"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Gauge,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  NumberField,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { chipsFor } from "./crenup-steps";
import {
  computeCreateCost,
  computeEnrichTickCost,
} from "./cost-model";
import { UpdationView } from "./UpdationView";
import { DISCOVERY_MAP_HREF } from "@/app/(app)/filters-config/nav";
import {
  updateAtlasConfig,
  type CrenupPrompt,
} from "./actions";
import {
  Fields,
  FlowEstimate,
  FlowPanel,
  Tag,
} from "./blocks";
import { CrenupSaveBar } from "./CrenupSaveBar";
import { SectionStrip, type CrenupView } from "./SectionStrip";
import { clampFunnel, savePayload, type CrenupSettings } from "./crenup-guards";
import { MODELS_PARENT } from "../models-config/nav";
import { UPRICH_PARENT } from "./nav";

/** The Create box on Multiple Places — where Create actually runs. */
const CREATE_BOX_HREF = "/manage-multiple#create";

// THE CRENUP PAGES (MESITA-2083: two rail rows, two pages, one client).
//   Creation    Models (a link to /models-config) · Create
//   Updation    Fast Update · Deep Update · Deep Enrich (UpdationView.tsx, MESITA-3939)
// Discovery-shaped. One Save for atlas_* on both. Search eligibility lives
// on Discovery › Map. Creation had a third module, Verification, until
// MESITA-2106: the MVP has no business app, so nobody proves ownership.


/** One Create-on-open switch (MESITA-2298): the label, the hint, the toggle. */
function CreateOnOpenRow({
  label,
  hint,
  on,
  pending,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-border bg-card flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{label}</p>
        <p className="text-muted-foreground mt-0.5 type-meta">{hint}</p>
      </div>
      <Switch on={on} pending={pending} onClick={onToggle} label={label} />
    </div>
  );
}

export function CrenupClient({
  view,
  initialSettings,
  settingsUpdatedAt,
  settingsLoadError,
  prompts,
}: {
  view: CrenupView;
  initialSettings: CrenupSettings;
  settingsUpdatedAt: string | null;
  settingsLoadError: string | null;
  /**
   * What each model is TOLD, straight from the backend. Read-only, and empty
   * when the GET failed — a prompt disclosure that invents its own text would
   * be worse than an absent one.
   */
  prompts: CrenupPrompt[];
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
      const r = await updateAtlasConfig(savePayload(settings));
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
      <SectionStrip view={view} />

      {/* pb-24 keeps the last module clear of the sticky CrenupSaveBar. */}
      <div className="flex flex-col gap-4 pb-24">
        {view === "creation" && (
        <>
        <div id="s-models" className="scroll-mt-16">
          <SectionCard
            icon={<Gauge className="text-secondary h-4 w-4" />}
            title="Models"
          >
            <p className="text-muted-foreground mt-4 text-sm">
              Which AI model each step uses is set on{" "}
              <Link
                href={MODELS_PARENT.href}
                className="text-foreground font-semibold underline underline-offset-2"
              >
                Models ›
              </Link>
            </p>
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
                        Discovery&apos;s place rules
                      </Link>{" "}
                      decide whether the add is allowed: only Mesita&apos;s place types.
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
              // Functions lives on Updation, so Create's chips cross over.
              steps={chipsFor("create", UPRICH_PARENT.href).map((c) =>
                // Seed is Create's own step (MESITA-3939): it stays here.
                c.number === 0 ? { ...c, href: "#s-create" } : c,
              )}
              estimate={
                <FlowEstimate
                  caption="Details + Description + Vectors. One place."
                  estimate={createCost}
                />
              }
            />
            <div className="mt-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Create mints the ugly profile without queuing the Enricher.
                Updation&apos;s Deep Enrich (first after N views) decides
                when it runs by itself.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  A Google result in a list is not a profile. Browsing the map,
                  the Feed or a search list never creates one; tapping a pin or
                  seeing a card never creates one. Opening the full profile
                  does: Mesita looks the place up by its Google Place ID and
                  creates its Mesita Place if none exists. Each app has its own
                  switch.
                </p>
                <CreateOnOpenRow
                  label="Create the profile on open · consumer app"
                  hint="A guest opens a Google-only place from Map, the Feed, or Word."
                  on={settings.createOnOpenConsumer}
                  pending={pending}
                  onToggle={() =>
                    patch({ createOnOpenConsumer: !settings.createOnOpenConsumer })
                  }
                />
                <CreateOnOpenRow
                  label="Create the profile on open · admin app"
                  hint="An admin opens a Google-only row from Single Place › Find."
                  on={settings.createOnOpenAdmin}
                  pending={pending}
                  onToggle={() =>
                    patch({ createOnOpenAdmin: !settings.createOnOpenAdmin })
                  }
                />
                <Fields>
                  <NumberField
                    icon={<Users className="text-muted-foreground h-4 w-4" />}
                    label="Guest creates per day"
                    value={settings.consumerCreatesPerDay}
                    min={1}
                    max={10000}
                    onChange={(v) => patch({ consumerCreatesPerDay: v })}
                    disabled={pending}
                  />
                </Fields>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  How many places one guest may create in 24 hours. Past it, the
                  open says the daily limit is reached. 1000 while testing; lower
                  it before launch.
                </p>
              </div>
              {/* This page CONFIGURES Create; it does not run it. The door is
                  Multiple Places › Create, same idiom as the Models section's jump. */}
              <p className="text-muted-foreground mt-3 text-sm">
                <Link
                  href={CREATE_BOX_HREF}
                  className="text-foreground font-semibold underline underline-offset-2"
                >
                  Create a place ›
                </Link>
              </p>
            </div>
          </SectionCard>
        </div>

        </>
        )}

        {view === "uprich" && (
          <UpdationView
            settings={settings}
            patch={patch}
            pending={pending}
            blocked={!!blocked}
            prompts={prompts}
            enrichCost={enrichCost}
          />
        )}
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
