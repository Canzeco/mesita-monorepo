"use client";

// The OPERATOR FLOOR on the listed Mesita pool — `discovery_config.filters`.
//
// Sibling of the Google quality floor, and the other half of the same
// question. The General gate wipes what GOOGLE returned; this one is a pair
// of `gte` predicates on the Mesita pool query itself
// (`_shared/discovery-filters.ts`), so it reaches the lanes that never call
// Google at all: the Home rails (consumer-web-list-catalog), the Pay /
// Home / bbox branch of consumer-web-list-places, and Swipe. On the nearby
// branch `listedMapFilters` maxes it with Map's own floors.
//
// UNTIL MESITA-1667 THIS SLICE HAD NO KNOB AND NO WAY TO GET ONE. It was
// enforced on every one of those lanes, sat at 0, and `updateDiscoveryConfig`
// had no `"filters"` member — so it rode through every save untouched on
// `...live.config`. Enforced-and-unreachable is worse than unenforced: the
// operator cannot even see the rule they are subject to.
//
// requireReady and maxDistanceKm stay off this box on purpose. The first is
// the enrichment lifecycle gate (`content_state = 'ready'`), not a quality
// floor — switching it off admits half-built places. The second is geography,
// and it becomes a bounding box with a corner trim. Different questions.

import { useEffect, useMemo, useState, useTransition } from "react";
import { MessageSquare, ScanSearch, Star } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobState,
  NumberField,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DEFAULT_CONFIG,
  GENERAL_MIN_REVIEWS_MAX,
  MIN_RATING_MAX,
  type DiscoveryConfig,
  type DiscoveryFilters,
} from "./catalog";

export function PoolQualityFloorCard({
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

  // Only the two floors. requireReady and maxDistanceKm ride the same slice
  // and are edited nowhere, so a stale one must never light up Save here.
  const dirty = useMemo(
    () =>
      cfg.filters.minReviews !== saved.filters.minReviews ||
      cfg.filters.minRating !== saved.filters.minRating,
    [cfg.filters, saved.filters],
  );

  const patch = (p: Partial<DiscoveryFilters>) => {
    setOk(false);
    setCfg((c) => ({ ...c, filters: { ...c.filters, ...p } }));
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, ["filters"]);
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

  const filters = cfg.filters ?? DEFAULT_CONFIG.filters;

  return (
    <div id="s-pool-quality" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<ScanSearch className="text-primary h-4 w-4" />}
        title="Mesita pool quality floor"
        subtitle="The floor on the listed pool itself, for the lanes that never call Google — the Home rails, the Pay and viewport-map branch, and Swipe."
        state={
          <KnobState
            kind="enforced"
            reason="Home rails · Pay · bbox map · Swipe · maxed with Map's on nearby"
          />
        }
      >
        <p className="text-muted-foreground mt-5 type-meta">
          The Google floor above cuts what Google returned. This one cuts the
          Mesita pool query itself, so it reaches the modes that never ask
          Google anything.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Minimum reviews"
            value={filters.minReviews}
            min={0}
            max={GENERAL_MIN_REVIEWS_MAX}
            disabled={pending || loadBlocked}
            onChange={(minReviews) => patch({ minReviews })}
          />
          <NumberField
            icon={<Star className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Minimum rating"
            value={filters.minRating}
            min={0}
            max={MIN_RATING_MAX}
            decimals
            disabled={pending || loadBlocked}
            onChange={(minRating) => patch({ minRating })}
          />
        </div>

        <p className="text-muted-foreground mt-4 type-meta">
          {filters.minReviews > 0 || filters.minRating > 0
            ? "Both run as gte, which drops a place with no number at all — a floor asks a place to prove it clears the bar."
            : "0 is off on both. Any number asks a place to prove it; one with no rating or no review count is dropped too."}
        </p>
        <p className="text-muted-foreground mt-2 type-meta">
          In a young catalog most places are unrated, so a rating floor of 3.0
          can empty a rail that a review floor would only thin. Reach for the
          count first.
        </p>

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
