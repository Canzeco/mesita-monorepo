import { LinearGradient } from 'expo-linear-gradient';
import { Star, Users } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChannelMark } from '@/components/brand/channel-marks';
import { MesitaMark } from '@/components/brand/MesitaMark';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { formatRating } from '@/lib/utils';

// ── Source badges — RN port of web BrandLogos (Google / Instagram /
//    Facebook / Mesita). Same shape language: a 32px (md) / 20px (sm) tile
//    per source so the reviews-summary row and review cards read as branded
//    attributions rather than bare text labels.

/** Multi-colour Google "G" inside a white circle. */
export function GoogleBadge({ size = 32 }: { size?: number }) {
  return (
    <View
      className="items-center justify-center rounded-full bg-white"
      style={{ width: size, height: size }}
    >
      <ChannelMark channel="google" size={Math.round(size * 0.62)} />
    </View>
  );
}

/** Instagram brand-gradient tile with a white glyph. */
export function InstagramBadge({ size = 32 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[...GRADIENTS.instagram]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ChannelMark channel="instagram" size={Math.round(size * 0.5)} color="#ffffff" />
    </LinearGradient>
  );
}

/** Facebook brand-blue tile with a white glyph. */
export function FacebookBadge({ size = 32 }: { size?: number }) {
  return (
    <View
      className="items-center justify-center rounded-lg"
      style={{ width: size, height: size, backgroundColor: '#1877F2' }}
    >
      <ChannelMark channel="facebook" size={Math.round(size * 0.5)} color="#ffffff" />
    </View>
  );
}

/** Mesita flame in a pink-gradient badge — circle (md) or rounded square (sm). */
export function MesitaBadge({
  variant = 'md',
}: {
  variant?: 'sm' | 'md';
}) {
  const size = variant === 'sm' ? 20 : 32;
  return (
    <LinearGradient
      colors={[...GRADIENTS.pink]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{
        width: size,
        height: size,
        borderRadius: variant === 'sm' ? 6 : 999,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MesitaMark size={Math.round(size * 0.6)} color="#ffffff" />
    </LinearGradient>
  );
}

export function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <View className="flex-row items-center gap-2">
      <Text className="w-14 text-[11px] text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{ height: '100%', width: `${pct}%`, borderRadius: 999 }}
        />
      </View>
      <Text className="w-8 text-right text-[11px] font-semibold tabular-nums text-foreground">
        {formatRating(value)}
      </Text>
    </View>
  );
}

export function ExternalCard({
  logo,
  icon,
  value,
  meta,
}: {
  logo: ReactNode;
  icon: 'star' | 'users';
  value: string;
  meta: string;
}) {
  return (
    <View className="flex-1 items-center gap-1.5 rounded-xl bg-background px-2 py-3">
      <View className="mb-1">{logo}</View>
      <View className="flex-row items-center gap-1">
        {icon === 'star' ? (
          <Star color="#fbbf24" fill="#fbbf24" size={14} />
        ) : (
          <Users color="#775254" size={14} />
        )}
        <Text className="text-sm font-semibold text-foreground">{value}</Text>
      </View>
      <Text className="text-[10px] leading-tight text-muted-foreground">
        {meta}
      </Text>
    </View>
  );
}

// decision: Pato — frontend-only review sort (no EF) for both Google and
// Mesita. Newest default; Highest / Lowest by rating. Google uses published
// date; Mesita uses avg(food/service/ambience/value) and keeps source order
// for Newest until visitors carry a date field.
export type ReviewSort = 'newest' | 'highest' | 'lowest';

const REVIEW_SORTS: { key: ReviewSort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'highest', label: 'Highest' },
  { key: 'lowest', label: 'Lowest' },
];

export function reviewTimeMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

export function mesitaOverall(
  v: PlaceDetail['mesita_visitors'][number],
): number {
  return (v.food + v.service + v.ambience + v.value) / 4;
}

export function ReviewSortChips({
  sort,
  onSort,
  label,
}: {
  sort: ReviewSort;
  onSort: (next: ReviewSort) => void;
  label: string;
}) {
  return (
    <View
      className="flex-row gap-1 rounded-xl bg-muted/60 p-1"
      accessibilityLabel={label}
    >
      {REVIEW_SORTS.map((mode) => (
        <Pressable
          key={mode.key}
          onPress={() => onSort(mode.key)}
          className={`flex-1 items-center rounded-lg py-1.5 ${
            sort === mode.key ? 'bg-card' : ''
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              sort === mode.key ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {mode.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
