import { LinearGradient } from 'expo-linear-gradient';
import { Star, Users } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { formatRating } from '@/lib/utils';

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
  label,
  icon,
  value,
  meta,
}: {
  label: string;
  icon: 'star' | 'users';
  value: string;
  meta: string;
}) {
  return (
    <View className="flex-1 items-center gap-1.5 rounded-xl bg-background px-2 py-3">
      <Text className="mb-1 text-[10px] font-bold text-muted-foreground">
        {label}
      </Text>
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
// date; Mesita uses avg(food/service/ambiance/value) and keeps source order
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
  return (v.food + v.service + v.ambiance + v.value) / 4;
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
