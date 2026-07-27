import { LinearGradient } from 'expo-linear-gradient';
import { Compass, RotateCcw, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { GRADIENTS, GRADIENT_DIAGONAL, SHADOW_GLOW } from '@/constants/brand';
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

export function ActionBtn({
  label,
  Icon,
  onPress,
  disabled,
  primary,
  filled,
  showDot,
}: {
  label: string;
  Icon: typeof X;
  onPress?: () => void;
  disabled?: boolean;
  primary?: boolean;
  filled?: boolean;
  /** Red status dot (top-right) — used for the "filters active" Filter button. */
  showDot?: boolean;
}) {
  if (primary) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="h-12 flex-1 active:opacity-90"
        style={{ borderRadius: 8, overflow: 'hidden' }}
      >
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={[
            {
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderRadius: 8,
            },
            SHADOW_GLOW,
          ]}
        >
          <Icon color="#fff" size={16} fill={filled ? '#fff' : 'transparent'} />
          <Text className="text-xs font-semibold text-white">{label}</Text>
        </LinearGradient>
        {showDot ? <ActionDot /> : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-12 flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border ${
        disabled ? 'bg-muted/40' : 'bg-card active:bg-muted'
      }`}
    >
      <Icon
        color={disabled ? '#77525499' : '#775254'}
        size={16}
        fill={filled ? '#fb2b7b' : 'transparent'}
      />
      <Text
        className={`text-xs font-medium ${disabled ? 'text-muted-foreground/70' : 'text-foreground/70'}`}
      >
        {label}
      </Text>
      {showDot ? <ActionDot /> : null}
    </Pressable>
  );
}

// Filters-active indicator — the red dot on the Filter button (MESITA-633).
function ActionDot() {
  return (
    <View
      className="absolute top-1 right-1 size-2 rounded-full border border-card bg-primary"
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
