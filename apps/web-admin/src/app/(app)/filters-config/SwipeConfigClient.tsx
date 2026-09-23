"use client";

// Scroll — LIVE (MESITA-1859). This box was a Soon card until now, on copy
// dated 2026-08-28 that justified itself with Home being parked. Home shipped:
// `ScrollDeck.tsx` is live in web-consumer and consumer-web-recommend-swipe
// is called on every load. A Soon card sitting above a live exponent column is
// the exact dishonesty the empty-state component's own header exists to
// prevent, so the copy could not survive this PR.
//
// THREE FIELDS, BECAUSE THREE FIELDS HAVE A READER. `minReviews` is an
// admission filter in `swipeAdmissionFilters`; `radiusKm` and
// `closingBufferMin` draw the lead band in consumer-web-recommend-swipe —
// open places inside the radius come first, everything else follows, and
// neither can empty the deck any more (MESITA-2047). The five
// 2026-08-26 ranking knobs that used to sit on this slice are deleted, not
// hidden: the exponents live in one table, and a dead proximity/stars/log
// multiplier beside a live per-mode Proximity exponent would read as a
// second, competing dial.
// The guest category-filter default stays on the blob and gets no control —
// nothing reads it, and the empty-state rule this card just left forbids
// staging a dead knob.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Clock, GalleryHorizontalEnd, MapPin, Star } from "lucide-react";
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
  DISCOVERY_MODE_SOURCES,
  SWIPE_CLOSING_BUFFER_MAX,
  SWIPE_RADIUS_KM_MAX,
  SWIPE_RADIUS_KM_MIN,
  type DiscoveryConfig,
  type SwipeConfig,
} from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";

export function SwipeConfigClient({
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

  const dirty = useMemo(
    () => JSON.stringify(cfg.swipe) !== JSON.stringify(saved.swipe),
    [cfg.swipe, saved.swipe],
  );
  const dirtyRef = useRef(dirty);
  // Written in an effect, never during render (the refs lint rule, and the
  // reason behind it: a ref read during render does not re-render anything).
  // Effects flush in declaration order, so this one lands before the seed
  // effect below ever awaits.
  useEffect(() => {
    dirtyRef.current = dirty;
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getDiscoveryConfig();
      if (!active) return;
      if (!r.ok) {
        // Unconditional: a swallowed refetch failure leaves an operator
        // tuning against stale numbers and saving them over live config.
        setError(r.error);
        setLoadBlocked(true);
        return;
      }
      if (!dirtyRef.current) {
        setCfg(r.config);
        setSaved(r.config);
      }
      setUpdatedAt(r.updatedAt);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const patch = (p: Partial<SwipeConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, swipe: { ...c.swipe, ...p } }));
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, ["swipe"]);
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

  const swipe = cfg.swipe ?? DEFAULT_CONFIG.swipe;

  return (
    <div id="s-swipe" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<GalleryHorizontalEnd className="text-primary h-4 w-4" />}
        title="Scroll"
        subtitle="Home's ranked deck. Google reviewers cut the pool. Radius and the closing buffer pick who leads: places open inside the radius come first, then open and closed places within Proximity's reach (its max km), then other cities — so Scroll is never empty while the catalog has a place. Places Lineup ranks each group under the Scroll column."
        state={
          <KnobState
            kind="enforced"
            reason="consumer-web-recommend-swipe admits the pool"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <NumberField
            icon={<MapPin className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Radius (km)"
            value={swipe.radiusKm}
            min={SWIPE_RADIUS_KM_MIN}
            max={SWIPE_RADIUS_KM_MAX}
            decimals
            onChange={(radiusKm) => patch({ radiusKm })}
            disabled={pending || loadBlocked}
          />
          <NumberField
            icon={<Star className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Minimum Google reviewers"
            value={swipe.minReviews}
            min={0}
            max={100_000}
            onChange={(minReviews) => patch({ minReviews })}
            disabled={pending || loadBlocked}
          />
          <NumberField
            icon={<Clock className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Closing buffer (min)"
            value={swipe.closingBufferMin}
            min={0}
            max={SWIPE_CLOSING_BUFFER_MAX}
            onChange={(closingBufferMin) => patch({ closingBufferMin })}
            disabled={pending || loadBlocked}
          />
        </div>

        <p className="text-muted-foreground/80 mt-4 max-w-md type-meta">
          Weights: in the table above. The exponents Scroll ranks by are the
          Scroll column of Signal weights by mode, not a knob on this card.
        </p>
        <ModeSourceChips sources={DISCOVERY_MODE_SOURCES.swipe} />

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
