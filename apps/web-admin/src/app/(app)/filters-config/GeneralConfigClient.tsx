"use client";

// General hyperparameters — live. Only knobs that apply across Discovery.
// categoryCount is the first N of the code-defined Google types. Fast Search,
// Deep Search, and Map still own their type toggles.

import { useEffect, useMemo, useState, useTransition } from "react";
import { SlidersHorizontal, Tags } from "lucide-react";
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
  GENERAL_CATEGORY_COUNT_MAX,
  type DiscoveryConfig,
  type GeneralConfig,
} from "./catalog";

export const DISCOVERY_GENERAL_EVENT = "mesita-discovery-general";

export function publishGeneralConfig(general: GeneralConfig) {
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

  const dirty = useMemo(
    () => JSON.stringify(cfg.general) !== JSON.stringify(saved.general),
    [cfg.general, saved.general],
  );

  const patch = (p: Partial<GeneralConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, general: { ...c.general, ...p } }));
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, ["general"]);
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

  return (
    <div id="s-general" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<SlidersHorizontal className="text-primary h-4 w-4" />}
        title="General"
        subtitle="Parameters that apply across Discovery. How many of the code-defined Google types any engine may use. Fast Search, Deep Search, and Map still pick among those types on their own boxes."
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
            onChange={(categoryCount) => patch({ categoryCount })}
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
