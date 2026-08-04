import { Compass, RotateCcw, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { COLORS } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { haversineKm } from '@/lib/utils';

export type Coords = { lat: number; lng: number };

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
  actionIcon: ActionIcon,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionIcon?: typeof RotateCcw;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <View className="size-14 items-center justify-center rounded-2xl bg-muted">
        <Compass color="#775254" size={24} />
      </View>
      <Text className="text-center font-display text-2xl font-semibold text-foreground">
        {title}
      </Text>
      <Text className="max-w-xs text-center text-sm text-muted-foreground">
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          disabled={actionDisabled}
          className="mt-2 flex-row items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 active:opacity-90 disabled:opacity-70"
        >
          {ActionIcon ? <ActionIcon color="#fff7f8" size={16} /> : null}
          <Text className="text-sm font-semibold text-background">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// The deck's action rail button. Mirrors
// apps/web-consumer/.../swipe/swipe-action-row.tsx — values, not classes,
// because this package is NativeWind 4 / Tailwind 3.4 and the web one is
// Tailwind v4.
//
// COLOUR IS NOT DECORATION HERE. The first pass gave each button its own hue
// and it read cheap for three measurable reasons: every token in this app
// lives in one warm band (background hue 10, primary hue 5), so amber/sky/
// violet were an imported palette; Skip and Save were hue TWINS despite being
// opposite verbs; and five equal rings cancelled the size hierarchy. So the
// utilities recede to neutral, Skip is neutral but heavier, and Save is the
// ONLY colour in the row.
export type ActionVariant = 'utility' | 'skip' | 'save';

const NEUTRAL_RING = '#e8d7db'; // --border, warm
const NEUTRAL_GLYPH = '#775254'; // --muted-foreground
const SKIP_RING = '#3a142040'; // foreground @ 25%
const SKIP_GLYPH = '#3a1420cc';

export function ActionBtn({
  label,
  Icon,
  variant,
  onPress,
  disabled,
  filled,
  showDot,
}: {
  label: string;
  Icon: typeof X;
  variant: ActionVariant;
  onPress?: () => void;
  disabled?: boolean;
  filled?: boolean;
  /** Red status dot (top-right) — used for the "filters active" Filter button. */
  showDot?: boolean;
}) {
  const big = variant !== 'utility';
  const size = big ? 60 : 48;
  const save = variant === 'save';
  const ring = save
    ? COLORS.primary
    : variant === 'skip'
      ? SKIP_RING
      : NEUTRAL_RING;
  const glyph = save
    ? '#ffffff'
    : variant === 'skip'
      ? SKIP_GLYPH
      : NEUTRAL_GLYPH;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center active:opacity-80"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: ring,
        backgroundColor: save ? COLORS.primary : '#ffffff',
        opacity: disabled ? 0.5 : 1,
        shadowColor: save ? COLORS.primary : '#501428',
        shadowOpacity: save ? 0.5 : 0.16,
        shadowRadius: save ? 12 : 7,
        shadowOffset: { width: 0, height: save ? 5 : 2 },
        elevation: save ? 4 : 2,
      }}
    >
      <Icon
        color={glyph}
        size={big ? 28 : 20}
        strokeWidth={2.25}
        fill={filled ? glyph : 'transparent'}
      />
      {showDot ? <ActionDot /> : null}
    </Pressable>
  );
}

// Filters-active indicator — the red dot on the Filter button (MESITA-633).
function ActionDot() {
  return (
    <View
      className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-red-500"
      pointerEvents="none"
    />
  );
}

export function sortPartnersFirst(input: Place[]): Place[] {
  return [...input].sort((a, b) => {
    const aRank = a.listing_type === 'partner' ? 0 : 1;
    const bRank = b.listing_type === 'partner' ? 0 : 1;
    return aRank - bRank;
  });
}

export function shuffleDeck(input: Place[]): Place[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function withUserDistance(place: Place, coords: Coords | null): Place {
  if (coords) {
    const lat = toCoord(place.lat);
    const lng = toCoord(place.lng);
    if (lat != null && lng != null) {
      const km = haversineKm(coords.lat, coords.lng, lat, lng);
      const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
      return { ...place, distance_km: Math.max(rounded, 0.1) };
    }
  }
  return place.distance_km != null ? place : { ...place, distance_km: 0 };
}

function toCoord(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
