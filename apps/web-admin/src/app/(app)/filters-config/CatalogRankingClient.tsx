"use client";

import { GalleryHorizontal } from "lucide-react";
import { Button, KnobState, NumberField, SectionCard } from "@/components/admin-ui/config";
import {
  useConfigEditor,
  type ConfigSeed,
} from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  CATALOG_RANK_KEYS,
  SUPER_FIELDS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type CatalogRankKey,
  type DiscoveryConfig,
} from "./catalog";

const RANK_LABEL: Record<CatalogRankKey, string> = {
  name: "Name",
  description: "Description",
  proximity: "Proximity",
  popularity: "Popularity",
  selected: "Selected",
  randomness: "Randomness",
};

export function CatalogRankingClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: ConfigSeed<DiscoveryConfig>) {
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, saveWith } =
    useConfigEditor({
      initialConfig,
      initialUpdatedAt,
      loadError,
      load: getDiscoveryConfig,
    });
  const dirty =
    JSON.stringify(cfg.catalog.ranking) !== JSON.stringify(saved.catalog.ranking);

  return (
    <div className="flex flex-col gap-10">
      <SectionCard
        icon={<GalleryHorizontal className="text-primary h-4 w-4" />}
        title="Ranking profile"
        subtitle="One profile for every list. The only difference between lists is the family filter. Exponents run from 0 (off) to 4. Randomness ships off."
        state={
          <KnobState
            kind="not-wired"
            reason="stored on discovery_config.catalog.ranking; Catalog Search does not rank with it yet"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG_RANK_KEYS.map((key) => (
            <NumberField
              key={key}
              label={RANK_LABEL[key]}
              value={cfg.catalog.ranking[key]}
              min={WEIGHT_MIN}
              max={WEIGHT_MAX}
              decimals
              disabled={pending || loadBlocked}
              onChange={(value) => {
                setOk(false);
                setCfg({
                  ...cfg,
                  catalog: {
                    ...cfg.catalog,
                    ranking: { ...cfg.catalog.ranking, [key]: value },
                  },
                });
              }}
            />
          ))}
        </div>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          Family is the list filter. Enriched is the admission gate. Timing
          is not in this profile. Selected here is the exponent; a place
          with no admin value abstains.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Button
            pending={pending}
            disabled={!dirty || loadBlocked}
            onClick={() => saveWith((next) => updateDiscoveryConfig(next, ["catalogRanking"]))}
          >
            Save
          </Button>
          {ok && !dirty && (
            <span className="text-muted-foreground text-sm">Saved</span>
          )}
          {error && <span className="text-destructive text-sm">{error}</span>}
        </div>
      </SectionCard>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-semibold tracking-tight">
          Lists
        </h2>
        <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-2xl border">
          {SUPER_FIELDS.map((family) => (
            <li
              key={family.key}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium">
                <span className="mr-2" aria-hidden>{family.emoji}</span>
                {family.label}
              </span>
              <span className="text-muted-foreground text-sm">
                Family filter · shared profile
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
