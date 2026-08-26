"use client";

// Social hyperparameters — staged. Home › Social will query events at
// places, not places. No engine reads these yet. Whole-blob save rides
// on the parent so a Catalog Save cannot wipe social.

import { Calendar, Filter, Layers, Sparkles, Users } from "lucide-react";
import {
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { formatShortDate } from "@/lib/format";
import {
  DEFAULT_CONFIG,
  SOCIAL_COUNT_MAX,
  SOCIAL_EVENTS_PER_RAIL_MAX,
  SOCIAL_EVENTS_PER_RAIL_MIN,
  SOCIAL_HORIZON_DAYS_MAX,
  SOCIAL_HORIZON_DAYS_MIN,
  SOCIAL_MIN_SEED_EVENTS_MAX,
  type SocialConfig,
} from "./catalog";

export function SocialConfigCard({
  social,
  pending,
  loadBlocked,
  loadError,
  dirty,
  ok,
  updatedAt,
  onPatch,
  onSave,
}: {
  social: SocialConfig;
  pending: boolean;
  loadBlocked: boolean;
  loadError: string | null;
  dirty: boolean;
  ok: boolean;
  updatedAt: string | null;
  onPatch: (p: Partial<SocialConfig>) => void;
  onSave: () => void;
}) {
  const s = social ?? DEFAULT_CONFIG.social;
  return (
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
          onChange={(seedCount) => onPatch({ seedCount })}
        />
        <NumberField
          icon={<Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
          label="Generated rails (vibe queries over events)"
          value={s.generatedCount}
          min={0}
          max={SOCIAL_COUNT_MAX}
          disabled={pending || loadBlocked}
          onChange={(generatedCount) => onPatch({ generatedCount })}
        />
        <NumberField
          icon={<Users className="mt-0.5 h-4 w-4 shrink-0" />}
          label="Events per rail"
          value={s.eventsPerRail}
          min={SOCIAL_EVENTS_PER_RAIL_MIN}
          max={SOCIAL_EVENTS_PER_RAIL_MAX}
          disabled={pending || loadBlocked}
          onChange={(eventsPerRail) => onPatch({ eventsPerRail })}
        />
        <NumberField
          icon={<Filter className="mt-0.5 h-4 w-4 shrink-0" />}
          label="Min events before a seed type appears"
          value={s.minSeedEvents}
          min={1}
          max={SOCIAL_MIN_SEED_EVENTS_MAX}
          disabled={pending || loadBlocked}
          onChange={(minSeedEvents) => onPatch({ minSeedEvents })}
        />
        <NumberField
          icon={<Calendar className="mt-0.5 h-4 w-4 shrink-0" />}
          label="Horizon (days ahead)"
          value={s.horizonDays}
          min={SOCIAL_HORIZON_DAYS_MIN}
          max={SOCIAL_HORIZON_DAYS_MAX}
          disabled={pending || loadBlocked}
          onChange={(horizonDays) => onPatch({ horizonDays })}
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
        onClick={onSave}
        loadError={loadBlocked ? loadError : null}
      />
    </SectionCard>
  );
}
