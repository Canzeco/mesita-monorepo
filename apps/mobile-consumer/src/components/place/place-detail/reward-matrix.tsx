import { LinearGradient } from 'expo-linear-gradient';
import { Crown, type LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';
import type { ConsumerClassKey } from '@/lib/types/place-detail';

export function RewardStep({
  n,
  icon: Icon,
  title,
  body,
  accent,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <View className="flex-row gap-3">
      <View
        className={`relative mt-0.5 size-7 items-center justify-center rounded-full ${
          accent ? 'bg-violet-500/10' : 'bg-pink-500/10'
        }`}
      >
        <Icon color={accent ? '#8b6ce8' : '#fb2b7b'} size={14} strokeWidth={2} />
        <View className="absolute -top-1 -right-1 size-4 items-center justify-center rounded-full bg-foreground">
          <Text className="text-[9px] font-bold text-background">{n}</Text>
        </View>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-semibold leading-tight text-foreground">
          {title}
        </Text>
        <Text className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          {body}
        </Text>
      </View>
    </View>
  );
}

export function RewardMatrix({
  welcome,
  returning,
  currentClass,
  isFirstVisit,
}: {
  welcome: { free: number | null; premium: number | null };
  returning: { free: number | null; premium: number | null };
  currentClass: ConsumerClassKey;
  isFirstVisit: boolean;
}) {
  const rows = [
    { key: 'first', label: 'First visit', vals: welcome, onAxis: isFirstVisit },
    {
      key: 'returning',
      label: 'Returning',
      vals: returning,
      onAxis: !isFirstVisit,
    },
  ] as const;
  return (
    <View className="overflow-hidden rounded-xl border border-border">
      <View className="flex-row items-center px-3 py-2.5">
        <View className="flex-1" />
        <Text className="flex-1 text-center font-display text-[13px] font-bold">
          Standard
        </Text>
        <View className="flex-1 flex-row items-center justify-center gap-1">
          <Crown color="#8b6ce8" size={12} fill="#8b6ce8" />
          <Text className="font-display text-[13px] font-bold text-[#8b6ce8]">
            Premium
          </Text>
        </View>
      </View>
      {rows.map((r, i) => (
        <View
          key={r.key}
          className={`flex-row items-center px-3 py-3 ${
            i > 0 ? 'border-t border-border/40' : ''
          }`}
        >
          <Text className="flex-1 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {r.label}
          </Text>
          <View className="flex-1 items-center">
            <RewardCell
              value={r.vals.free}
              active={r.onAxis && currentClass === 'standard'}
            />
          </View>
          <View className="flex-1 items-center">
            <RewardCell
              value={r.vals.premium}
              accent
              // Premium and Magnetic both read the elevated column.
              active={r.onAxis && currentClass !== 'standard'}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function RewardCell({
  value,
  accent,
  active,
}: {
  value: number | null;
  accent?: boolean;
  active?: boolean;
}) {
  const text = value == null ? '—' : `${value}%`;
  if (active) {
    return (
      <View className="relative">
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 12,
            paddingRight: 20,
            ...SHADOW_GLOW,
          }}
        >
          <Text className="font-display text-[15px] font-bold text-white">
            {text}
            {value != null ? (
              <Text className="text-[10px] text-white/85"> off</Text>
            ) : null}
          </Text>
        </LinearGradient>
        <Text className="absolute top-0.5 right-1.5 text-[7px] font-bold tracking-[0.1em] text-white/85 uppercase">
          Now
        </Text>
      </View>
    );
  }
  return (
    <Text
      className={`font-display text-[15px] font-bold ${
        accent ? 'text-violet-500' : 'text-foreground/80'
      }`}
    >
      {text}
      {value != null ? (
        <Text
          className={`text-[10px] ${
            accent ? 'text-violet-400' : 'text-muted-foreground'
          }`}
        >
          {' '}
          off
        </Text>
      ) : null}
    </Text>
  );
}
