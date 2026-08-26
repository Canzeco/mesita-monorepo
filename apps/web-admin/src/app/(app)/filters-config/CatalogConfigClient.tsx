"use client";

// Catalog hyperparameters — the one live Discovery box. Signals · Engines
// stay Soon. Whole-blob save: this form carries the rest of discovery_config
// so a Catalog Save cannot reset Swipe weights (MESITA-737).

import { useEffect, useMemo, useState, useTransition } from "react";
import { LayoutGrid, Layers, Sparkles, Filter } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  CATALOG_COUNT_MAX,
  CATALOG_MIN_SEED_PLACES_MAX,
  CATALOG_PLACES_PER_RAIL_MAX,
  CATALOG_PLACES_PER_RAIL_MIN,
  DEFAULT_CONFIG,
  type CatalogConfig,
  type DiscoveryConfig,
} from "./catalog";

export function CatalogConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: DiscoveryConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<DiscoveryConfig>(initialConfig);
  const [saved, setSaved] = useState<DiscoveryConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getDiscoveryConfig();
      if (!active) return;
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(cfg.catalog) !== JSON.stringify(saved.catalog),
    [cfg.catalog, saved.catalog],
  );

  const patchCatalog = (p: Partial<CatalogConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, catalog: { ...c.catalog, ...p } }));
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  const catalog = cfg.catalog ?? DEFAULT_CONFIG.catalog;

  return (
    <div className="space-y-6">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<LayoutGrid className="text-primary h-4 w-4" />}
        title="Catalog"
        subtitle="Home Catalog mixes Atlas categories that currently have inventory with vibe queries sampled from a code-defined bank. Each rail searches listed Mesita places. No Google."
        status={
          <KnobStatus
            kind="enforced"
            reason="consumer-web-list-catalog"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Layers className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Seed rails (Atlas categories with inventory)"
            value={catalog.seedCount}
            min={0}
            max={CATALOG_COUNT_MAX}
            disabled={pending || loadBlocked}
            onChange={(seedCount) => patchCatalog({ seedCount })}
          />
          <NumberField
            icon={<Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Generated rails (vibe queries)"
            value={catalog.generatedCount}
            min={0}
            max={CATALOG_COUNT_MAX}
            disabled={pending || loadBlocked}
            onChange={(generatedCount) => patchCatalog({ generatedCount })}
          />
          <NumberField
            icon={<LayoutGrid className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Places per rail"
            value={catalog.placesPerRail}
            min={CATALOG_PLACES_PER_RAIL_MIN}
            max={CATALOG_PLACES_PER_RAIL_MAX}
            disabled={pending || loadBlocked}
            onChange={(placesPerRail) => patchCatalog({ placesPerRail })}
          />
          <NumberField
            icon={<Filter className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Min places before a seed category appears"
            value={catalog.minSeedPlaces}
            min={1}
            max={CATALOG_MIN_SEED_PLACES_MAX}
            disabled={pending || loadBlocked}
            onChange={(minSeedPlaces) => patchCatalog({ minSeedPlaces })}
          />
        </div>
        {updatedAt ? (
          <p className="text-muted-foreground mt-4 type-meta">
            Last saved {formatShortDate(updatedAt)}
          </p>
        ) : null}
        <SaveRow
          pending={pending}
          dirty={dirty}
          ok={ok}
          onClick={save}
          loadError={loadBlocked ? error : null}
        />
      </SectionCard>
    </div>
  );
}
