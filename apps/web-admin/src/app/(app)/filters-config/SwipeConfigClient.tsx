"use client";

// Swipe hyperparameters — live. Hard filters admit; a two-signal sum scores;
// partner bias multiplies after. Slice save so a Catalog Save cannot wipe this.

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Clock,
  Filter,
  GalleryHorizontalEnd,
  MapPin,
  MessageCircle,
  Scale,
  Sparkles,
  Star,
} from "lucide-react";
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
  SWIPE_CLOSING_BUFFER_MAX,
  SWIPE_CLOSING_BUFFER_MIN,
  SWIPE_LOG_DIVISOR_MAX,
  SWIPE_LOG_DIVISOR_MIN,
  SWIPE_PARTNER_BIAS_MAX,
  SWIPE_PARTNER_BIAS_MIN,
  SWIPE_PARTNER_LEVELS,
  SWIPE_RADIUS_KM_MAX,
  SWIPE_RADIUS_KM_MIN,
  SWIPE_STARS_EXPONENT_MAX,
  SWIPE_STARS_EXPONENT_MIN,
  type DiscoveryConfig,
  type SwipeConfig,
  type SwipePartnerLevel,
} from "./catalog";

const PARTNER_LABEL: Record<SwipePartnerLevel, string> = {
  none: "Not a partner",
  partner: "Partner, no promo",
  conservative: "Partner, Conservative rewards",
  aggressive: "Partner, Aggressive rewards",
  dominant: "Partner, Dominant rewards",
};

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

  const dirty = useMemo(() => {
    const a = { ...cfg.swipe, savedAt: null };
    const b = { ...saved.swipe, savedAt: null };
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [cfg.swipe, saved.swipe]);

  const patch = (p: Partial<SwipeConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, swipe: { ...c.swipe, ...p } }));
  };

  const patchBias = (key: SwipePartnerLevel, value: number) => {
    setOk(false);
    setCfg((c) => ({
      ...c,
      swipe: { ...c.swipe, partnerBias: { ...c.swipe.partnerBias, [key]: value } },
    }));
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
  const lastSaved = swipe.savedAt ?? updatedAt;
  const weightPopularity = Math.round((1 - swipe.weightProximity) * 100) / 100;

  return (
    <div id="s-swipe" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<GalleryHorizontalEnd className="text-primary h-4 w-4" />}
        title="Swipe"
        subtitle="For guests who are not looking for anything specific. Hard filters admit. A weighted sum of proximity and popularity scores the pool. Partner bias multiplies after — same feed, never a bought lane. Distance is Haversine from stored coordinates. No Google."
        status={
          <KnobStatus
            kind="enforced"
            reason="consumer-web-recommend-swipe"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<MapPin className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Radius (km, fixed for guests)"
            value={swipe.radiusKm}
            min={SWIPE_RADIUS_KM_MIN}
            max={SWIPE_RADIUS_KM_MAX}
            decimals
            disabled={pending || loadBlocked}
            onChange={(radiusKm) => patch({ radiusKm })}
          />
          <NumberField
            icon={<Clock className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Closing buffer (minutes)"
            value={swipe.closingBufferMin}
            min={SWIPE_CLOSING_BUFFER_MIN}
            max={SWIPE_CLOSING_BUFFER_MAX}
            disabled={pending || loadBlocked}
            onChange={(closingBufferMin) => patch({ closingBufferMin })}
          />
          <NumberField
            icon={<Scale className="mt-0.5 h-4 w-4 shrink-0" />}
            label={`Proximity weight (popularity ${weightPopularity})`}
            value={swipe.weightProximity}
            min={0}
            max={1}
            decimals
            disabled={pending || loadBlocked}
            onChange={(weightProximity) => patch({ weightProximity })}
          />
          <NumberField
            icon={<Star className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Stars exponent"
            value={swipe.starsExponent}
            min={SWIPE_STARS_EXPONENT_MIN}
            max={SWIPE_STARS_EXPONENT_MAX}
            decimals
            disabled={pending || loadBlocked}
            onChange={(starsExponent) => patch({ starsExponent })}
          />
          <NumberField
            icon={<Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Popularity log divisor"
            value={swipe.logDivisor}
            min={SWIPE_LOG_DIVISOR_MIN}
            max={SWIPE_LOG_DIVISOR_MAX}
            decimals
            disabled={pending || loadBlocked}
            onChange={(logDivisor) => patch({ logDivisor })}
          />
          <NumberField
            icon={<MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Min Google reviews"
            value={swipe.minReviews}
            min={0}
            max={100_000}
            disabled={pending || loadBlocked}
            onChange={(minReviews) => patch({ minReviews })}
          />
        </div>

        <p className="text-muted-foreground mt-5 type-meta font-semibold tracking-wide uppercase">
          Partner bias (min 1, max 2)
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {SWIPE_PARTNER_LEVELS.map((key) => (
            <NumberField
              key={key}
              icon={<Filter className="mt-0.5 h-4 w-4 shrink-0" />}
              label={PARTNER_LABEL[key]}
              value={swipe.partnerBias[key]}
              min={SWIPE_PARTNER_BIAS_MIN}
              max={SWIPE_PARTNER_BIAS_MAX}
              decimals
              disabled={pending || loadBlocked}
              onChange={(value) => patchBias(key, value)}
            />
          ))}
        </div>

        <div className="border-border bg-background mt-3 flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Category filter default</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Guest toggle. Off keeps the feed open. On starts the sheet with
              a category cut. The guest can still change it.
            </p>
          </div>
          <Switch
            on={swipe.categoryFilter}
            pending={pending || loadBlocked}
            onClick={() => patch({ categoryFilter: !swipe.categoryFilter })}
            label="Category filter default"
          />
        </div>

        {lastSaved ? (
          <p className="text-muted-foreground mt-4 type-meta">
            Last saved {formatShortDate(lastSaved)}
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
