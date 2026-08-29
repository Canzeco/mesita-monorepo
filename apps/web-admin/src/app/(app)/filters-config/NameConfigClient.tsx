"use client";

// Name hyperparameters — live. Two boxes, one blob (`discovery_config.name`).
// Fast Search is Autocomplete only. Deep Search calls Autocomplete, Text
// Search, and Places Lineup (Name signal only — Mesita `places.name`,
// not `google_name`). Nearby on Deep is the guest pin, not Nearby Search.
// Each candidate resolves, then Partners · Mesita · Google.

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BadgeCheck,
  Globe,
  Layers,
  Search,
  Store,
} from "lucide-react";
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
  DEFAULT_CONFIG,
  DISCOVERY_MODE_MODULES,
  NAME_LANE_COUNT_MAX,
  type DiscoveryConfig,
  type NameDeepConfig,
  type NameFastConfig,
} from "./catalog";
import { ModeModuleChips } from "./ModeModuleChips";

export function NameConfigClient({
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
  const [okSlice, setOkSlice] = useState<null | "fast" | "deep">(null);
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

  const fastDirty = useMemo(
    () => JSON.stringify(cfg.name.fast) !== JSON.stringify(saved.name.fast),
    [cfg.name.fast, saved.name.fast],
  );
  const deepDirty = useMemo(
    () => JSON.stringify(cfg.name.deep) !== JSON.stringify(saved.name.deep),
    [cfg.name.deep, saved.name.deep],
  );

  const patchFast = (p: Partial<NameFastConfig>) => {
    setOkSlice(null);
    setCfg((c) => ({ ...c, name: { ...c.name, fast: { ...c.name.fast, ...p } } }));
  };

  const patchDeep = (p: Partial<NameDeepConfig>) => {
    setOkSlice(null);
    setCfg((c) => ({ ...c, name: { ...c.name, deep: { ...c.name.deep, ...p } } }));
  };

  const save = (slice: "nameFast" | "nameDeep") => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, [slice]);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt);
        setOkSlice(slice === "nameFast" ? "fast" : "deep");
      } else {
        setError(r.error);
      }
    });
  };

  const name = cfg.name ?? DEFAULT_CONFIG.name;

  return (
    <div className="flex flex-col gap-10">
      {error ? <ErrorNote message={error} /> : null}

      <div id="s-name-fast" className="scroll-mt-16">
        <SectionCard
          icon={<Search className="text-primary h-4 w-4" />}
          title="Name (Fast Search)"
          subtitle="Google Places Autocomplete only. Google Places and Max results are the same cap — Max results stays for Deep symmetry. 0 is off. Map Filters never cut this list."
          status={
            <KnobStatus
              kind="enforced"
              reason="suggest-places · Search"
            />
          }
        >
          <ModeModuleChips modules={DISCOVERY_MODE_MODULES.fast} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <NumberField
              icon={<Globe className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Google places"
              value={name.fast.googleCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(googleCount) => patchFast({ googleCount, count: googleCount })}
            />
            <NumberField
              icon={<Layers className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Max results"
              value={name.fast.count}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(count) => patchFast({ count, googleCount: count })}
            />
          </div>
          {updatedAt ? (
            <p className="text-muted-foreground mt-4 type-meta">
              Last saved {formatShortDate(updatedAt)}
            </p>
          ) : null}
          <SaveRow
            pending={pending}
            dirty={fastDirty}
            ok={okSlice === "fast" && !fastDirty}
            onClick={() => save("nameFast")}
            loadError={loadBlocked ? error : null}
          />
        </SectionCard>
      </div>

      <div id="s-name-deep" className="scroll-mt-16">
        <SectionCard
          icon={<Layers className="text-primary h-4 w-4" />}
          title="Name (Deep Search)"
          subtitle="Nearby on Deep is the guest pin on Autocomplete, Text Search, and name match — not a Nearby Search. Name signal only (`places.name`, not `google_name`). Max results caps the merge. Map Filters never cut this list."
          status={
            <KnobStatus
              kind="enforced"
              reason="Places Lineup · Deep reads Name (off vs on)"
            />
          }
        >
          <ModeModuleChips modules={DISCOVERY_MODE_MODULES.deep} />
          <p className="text-muted-foreground mt-2 type-meta">
            Needs a location. No pin, no bias.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <NumberField
              icon={<BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Mesita partners"
              value={name.deep.partnerCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(partnerCount) => patchDeep({ partnerCount })}
            />
            <NumberField
              icon={<Store className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Mesita places"
              value={name.deep.mesitaCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(mesitaCount) => patchDeep({ mesitaCount })}
            />
            <NumberField
              icon={<Globe className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Google places"
              value={name.deep.googleCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(googleCount) => patchDeep({ googleCount })}
            />
            <NumberField
              icon={<Layers className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Max results"
              value={name.deep.count}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(count) => patchDeep({ count })}
            />
          </div>
          {updatedAt ? (
            <p className="text-muted-foreground mt-4 type-meta">
              Last saved {formatShortDate(updatedAt)}
            </p>
          ) : null}
          <SaveRow
            pending={pending}
            dirty={deepDirty}
            ok={okSlice === "deep" && !deepDirty}
            onClick={() => save("nameDeep")}
            loadError={loadBlocked ? error : null}
          />
        </SectionCard>
      </div>
    </div>
  );
}
