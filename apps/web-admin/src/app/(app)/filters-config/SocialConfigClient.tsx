"use client";

// Social hyperparameters — staged. Home › Social will query events at
// places, not places. No engine reads these yet. Slice Save so a Catalog
// Save cannot wipe social, and a Social Save cannot wipe catalog.

import { useEffect, useMemo, useState, useTransition } from "react";
import { Calendar, Filter, Layers, Sparkles, Users } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { formatShortDate } from "@/lib/format";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DEFAULT_CONFIG,
  SOCIAL_COUNT_MAX,
  SOCIAL_EVENTS_PER_RAIL_MAX,
  SOCIAL_EVENTS_PER_RAIL_MIN,
  SOCIAL_HORIZON_DAYS_MAX,
  SOCIAL_HORIZON_DAYS_MIN,
  SOCIAL_MIN_SEED_EVENTS_MAX,
  type DiscoveryConfig,
  type SocialConfig,
} from "./catalog";

export function SocialConfigClient({
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
    () => JSON.stringify(cfg.social) !== JSON.stringify(saved.social),
    [cfg.social, saved.social],
  );

  const patch = (p: Partial<SocialConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, social: { ...c.social, ...p } }));
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, ["social"]);
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

  const s = cfg.social ?? DEFAULT_CONFIG.social;

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<Users className="text-primary h-4 w-4" />}
        title="Social"
        subtitle="Home › Social stays a subcategory. The engine will query events (happenings a place hosts), not places. These knobs are tentative until that engine exists. Not an Events Config page."
        status={
          <KnobStatus
            kind="not-wired"
            reason="no events engine yet"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Layers className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Seed rails (event types with inventory)"
            value={s.seedCount}
            min={0}
            max={SOCIAL_COUNT_MAX}
            disabled={pending || loadBlocked}
            onChange={(seedCount) => patch({ seedCount })}
          />
          <NumberField
            icon={<Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Generated rails (vibe queries over events)"
            value={s.generatedCount}
            min={0}
            max={SOCIAL_COUNT_MAX}
            disabled={pending || loadBlocked}
            onChange={(generatedCount) => patch({ generatedCount })}
          />
          <NumberField
            icon={<Users className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Events per rail"
            value={s.eventsPerRail}
            min={SOCIAL_EVENTS_PER_RAIL_MIN}
            max={SOCIAL_EVENTS_PER_RAIL_MAX}
            disabled={pending || loadBlocked}
            onChange={(eventsPerRail) => patch({ eventsPerRail })}
          />
          <NumberField
            icon={<Filter className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Min events before a seed type appears"
            value={s.minSeedEvents}
            min={1}
            max={SOCIAL_MIN_SEED_EVENTS_MAX}
            disabled={pending || loadBlocked}
            onChange={(minSeedEvents) => patch({ minSeedEvents })}
          />
          <NumberField
            icon={<Calendar className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Horizon (days ahead)"
            value={s.horizonDays}
            min={SOCIAL_HORIZON_DAYS_MIN}
            max={SOCIAL_HORIZON_DAYS_MAX}
            disabled={pending || loadBlocked}
            onChange={(horizonDays) => patch({ horizonDays })}
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
