import { Compass, RotateCcw, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

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

// Tinder-style circular action button. Ring colour per action, two sizes:
// Skip and Save are the deck's real verbs and read big, the utilities sit
// small either side. Mirrors apps/web-consumer/.../swipe-action-row.tsx —
// values, not classes, because this package is NativeWind 4 / Tailwind 3.4
// and the web one is Tailwind v4.
export type ActionTone = 'amber' | 'rose' | 'sky' | 'pink' | 'violet';

const TONE: Record<ActionTone, { ring: string; glyph: string; press: string }> = {
  amber: { ring: '#fbbf24b3', glyph: '#f59e0b', press: '#fffbeb' },
  rose: { ring: '#fb7185b3', glyph: '#f43f5e', press: '#fff1f2' },
  sky: { ring: '#38bdf8b3', glyph: '#0ea5e9', press: '#f0f9ff' },
  pink: { ring: '#fb2b7bb3', glyph: '#fb2b7b', press: '#fff1f7' },
  violet: { ring: '#a78bfab3', glyph: '#8b5cf6', press: '#f5f3ff' },
};

export function ActionBtn({
  label,
  Icon,
  tone,
  big,
  onPress,
  disabled,
  filled,
  showDot,
}: {
  label: string;
  Icon: typeof X;
  tone: ActionTone;
  /** Skip / Save render one step larger. */
  big?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  filled?: boolean;
  /** Red status dot (top-right) — used for the "filters active" Filter button. */
  showDot?: boolean;
}) {
  const t = TONE[tone];
  const size = big ? 60 : 48;
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
        borderColor: t.ring,
        backgroundColor: filled ? t.press : '#ffffff',
        opacity: disabled ? 0.5 : 1,
        shadowColor: '#501428',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <Icon
        color={t.glyph}
        size={big ? 28 : 20}
        strokeWidth={2.25}
        fill={filled ? t.glyph : 'transparent'}
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
