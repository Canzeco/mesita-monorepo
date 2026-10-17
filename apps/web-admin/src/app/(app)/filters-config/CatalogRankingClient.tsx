"use client";

import { GalleryHorizontal } from "lucide-react";
import { Button, KnobState, NumberField, SectionCard } from "@/components/admin-ui/config";
import {
  useConfigEditor,
  type ConfigSeed,
} from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import { WEIGHT_MAX, WEIGHT_MIN, type DiscoveryConfig } from "./catalog";
import {
  CATALOG_ALL_ZERO_ERROR,
  CATALOG_LIVE_RANK_KEYS,
  CATALOG_LIVE_SIGNAL_COPY,
  catalogLiveWeightsAllZero,
  catalogRelativeExponents,
  catalogShareLabel,
} from "./catalog-shares";
import { CATALOG_FAMILY_FACTS } from "./discovery-surface";

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
  const shares = catalogRelativeExponents(cfg.catalog.ranking);
  const allZero = catalogLiveWeightsAllZero(cfg.catalog.ranking);

  return (
    <div className="flex flex-col gap-10">
      <SectionCard
        icon={<GalleryHorizontal className="text-primary h-4 w-4" />}
        title="Ranking"
        subtitle="One profile for every rail. Weights are relative: doubling every number does not change the order. Zero turns that signal off."
        state={
          <KnobState
            kind="enforced"
            reason="The catalog engine ranks every family list with this profile"
          />
        }
      >
        {loadBlocked && error ? (
          <p className="text-destructive mt-4 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG_LIVE_RANK_KEYS.map((key) => {
            const copy = CATALOG_LIVE_SIGNAL_COPY[key];
            return (
              <div key={key} className="flex flex-col gap-2">
                <NumberField
                  label={copy.label}
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
                <p className="text-sm font-medium tabular-nums">
                  Share {catalogShareLabel(shares[key])}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          Every ready Mesita place enters, enriched or not. Enriched ranks
          an enriched place ahead of a Created one; it does not keep the
          Created one out. Family only chooses which rail a place is in.
          This page does not edit family membership.
        </p>
        {allZero ? (
          <p className="text-destructive mt-3 text-sm" role="alert">
            {CATALOG_ALL_ZERO_ERROR}
          </p>
        ) : null}
        <div className="mt-5 flex items-center gap-3">
          <Button
            pending={pending}
            disabled={!dirty || loadBlocked || allZero}
            onClick={() => saveWith((next) => updateDiscoveryConfig(next, ["catalogRanking"]))}
          >
            Save
          </Button>
          {pending ? <span className="text-muted-foreground text-sm">Saving</span> : null}
          {ok && !dirty && !allZero ? (
            <span className="text-muted-foreground text-sm">Saved</span>
          ) : null}
          {!dirty && !ok && !pending && !allZero && !loadBlocked ? (
            <span className="text-muted-foreground text-sm">Unchanged</span>
          ) : null}
          {error && !loadBlocked ? (
            <span className="text-destructive text-sm" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      </SectionCard>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-semibold tracking-tight">
          Family lists
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Every list uses the profile above. Family is a filter. Undefined is
          not a list.
        </p>
        <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-2xl border">
          {CATALOG_FAMILY_FACTS.map((family) => (
            <li
              key={family.key}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium">
                <span aria-hidden>{family.emoji}</span> {family.label}
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
