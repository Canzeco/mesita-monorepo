import { AtSign, Crown, Users } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { formatCurrency } from '@/lib/api/pay';
import { classProperLabel, isElevatedClass } from '@/lib/consumer-classes';
import type { RewardStats } from '@/lib/hooks/useConsumerPayTickets';
import { firstInitials, formatCompactCount } from '@/lib/utils';

const ORIGIN_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  subscription: 'Subscription',
  invitation: 'Invite',
};

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="relative min-w-0 flex-1 items-center px-1">
      <Text
        className="font-extrabold tracking-tight text-white"
        style={{ fontSize: 18, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text
        className="mt-1 font-bold uppercase text-white/80"
        style={{ fontSize: 8.5, letterSpacing: 0.5 }}
      >
        {label}
      </Text>
    </View>
  );
}

export function IdentityStrip({
  displayName,
  classKey,
  origin,
}: {
  displayName: string;
  classKey: string;
  origin: string;
}) {
  const isElevated = isElevatedClass(classKey);
  return (
    <View className="mt-4 flex-row items-center gap-3 border-t border-white/20 pt-4">
      <View
        className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20"
        style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}
      >
        <Text className="text-sm font-extrabold text-white">
          {firstInitials(displayName)}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className="font-extrabold tracking-tight text-white"
          style={{ fontSize: 15 }}
        >
          {displayName}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          {isElevated ? (
            <>
              <Crown color="#fff" size={12} fill="#fff" />
              <Text className="text-white/90" style={{ fontSize: 11 }}>
                {classProperLabel(classKey)} · via{' '}
                {ORIGIN_LABEL[origin] ?? 'Mesita'}
              </Text>
            </>
          ) : (
            <Text className="text-white/90" style={{ fontSize: 11 }}>
              Standard member
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export function IgChips({
  igConnected,
  instagramHandle,
  followerCount,
}: {
  igConnected: boolean;
  instagramHandle?: string | null;
  followerCount: number;
}) {
  if (!igConnected) return null;
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {instagramHandle ? (
        <View className="flex-row items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1.5">
          <AtSign color="#fff" size={14} />
          <Text className="font-semibold text-white" style={{ fontSize: 11.5 }}>
            @{instagramHandle.replace(/^@/, '')}
          </Text>
        </View>
      ) : null}
      {followerCount > 0 ? (
        <View className="flex-row items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1.5">
          <Users color="#fff" size={14} />
          <Text className="font-semibold text-white" style={{ fontSize: 11.5 }}>
            {formatCompactCount(followerCount)} followers
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function Scorecard({ stats }: { stats: RewardStats }) {
  return (
    <View className="mt-4 flex-row border-t border-white/20 pt-4">
      <Stat value={String(stats.visits)} label="Visits" />
      <Stat
        value={stats.savedCents > 0 ? formatCurrency(stats.savedCents) : '—'}
        label="Saved"
      />
      <Stat value={String(stats.stories)} label="Stories" />
      <Stat value={String(stats.reviews)} label="Reviews" />
    </View>
  );
}
