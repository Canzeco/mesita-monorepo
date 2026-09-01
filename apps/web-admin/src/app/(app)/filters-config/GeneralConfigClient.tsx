"use client";

// Shared Google types — live. categoryCount is the first N of the
// code-defined types. The type batteries themselves live here, not on
// Fast / Deep / Map: one list, written onto all three Google callers.

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plug, SlidersHorizontal, Tags } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DEFAULT_CONFIG,
  GENERAL_CATEGORY_COUNT_MAX,
  NEARBY_TYPE_FIELDS,
  type DiscoveryConfig,
  type GeneralConfig,
  type NearbyTypeKey,
} from "./catalog";

const DISCOVERY_GENERAL_EVENT = "mesita-discovery-general";

function publishGeneralConfig(general: GeneralConfig) {
  window.dispatchEvent(new CustomEvent(DISCOVERY_GENERAL_EVENT, { detail: general }));
}

export function GeneralConfigClient({
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

  const types = cfg.map.types;
  const dirty = useMemo(() => {
    return (
      JSON.stringify({
        general: cfg.general,
        types: cfg.map.types,
      }) !==
      JSON.stringify({
        general: saved.general,
        types: saved.map.types,
      })
    );
  }, [cfg.general, cfg.map.types, saved.general, saved.map.types]);

  const patchGeneral = (p: Partial<GeneralConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, general: { ...c.general, ...p } }));
  };

  const patchType = (key: NearbyTypeKey, on: boolean) => {
    setOk(false);
    setCfg((c) => {
      const next = { ...c.map.types, [key]: on };
      return {
        ...c,
        name: {
          fast: { ...c.name.fast, types: next },
          deep: { ...c.name.deep, types: next },
        },
        map: { ...c.map, types: next },
      };
    });
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, ["general", "nameFast", "nameDeep", "map"]);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt);
        setOk(true);
        publishGeneralConfig(r.config.general);
      } else {
        setError(r.error);
      }
    });
  };

  const general = cfg.general ?? DEFAULT_CONFIG.general;
  const categoryCount = general.categoryCount;

  return (
    <div id="s-google-types" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<SlidersHorizontal className="text-primary h-4 w-4" />}
        title="Google types"
        subtitle="Which Google Places types Autocomplete, Nearby, and Text Search may bill. One list for all three. How many of the code-defined types are available, then which of those are on."
        status={
          <KnobStatus
            kind="enforced"
            reason="list-places · suggest-places · Search"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Tags className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Categories available"
            value={general.categoryCount}
            min={0}
            max={GENERAL_CATEGORY_COUNT_MAX}
            disabled={pending || loadBlocked}
            onChange={(categoryCount) => patchGeneral({ categoryCount })}
          />
        </div>
        <p className="text-muted-foreground mt-5 type-meta font-semibold tracking-wide uppercase">
          Google categories
        </p>
        {categoryCount < GENERAL_CATEGORY_COUNT_MAX ? (
          <p className="text-muted-foreground mt-1 type-meta">
            Types past the count stay saved but unused.
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {NEARBY_TYPE_FIELDS.map((field, i) => {
            const allowed = i < categoryCount;
            return (
              <div
                key={field.key}
                className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Plug className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{field.label}</p>
                    {!allowed ? (
                      <p className="text-muted-foreground type-meta">Past available count</p>
                    ) : null}
                  </div>
                </div>
                <Switch
                  on={types[field.key]}
                  pending={pending || loadBlocked || !allowed}
                  onClick={() => {
                    if (!allowed) return;
                    patchType(field.key, !types[field.key]);
                  }}
                  label={field.label}
                />
              </div>
            );
          })}
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
