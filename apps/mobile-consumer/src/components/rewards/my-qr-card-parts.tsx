import { useRouter } from 'expo-router';
import {
  AtSign,
  Camera,
  ChevronRight,
  Crown,
  DoorOpen,
  Megaphone,
  Sparkles,
  Star,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatCurrency } from '@/lib/api/pay';
import { classProperLabel, isElevatedClass } from '@/lib/consumer-classes';
import { rewardsTicketPath } from '@/lib/consumer-route-contract';
import type {
  PassTicketView,
  RewardStats,
} from '@/lib/hooks/useConsumerPayTickets';
import {
  PEAK_STRATEGY,
  reachableSegments,
  segmentKeyForClass,
  type RewardClassKey,
  type RewardSegmentKey,
} from '@/lib/reward-segments';
import { firstInitials, formatCompactCount } from '@/lib/utils';

const ORIGIN_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  subscription: 'Subscription',
  invitation: 'Invite',
};

function Stat({ value, label }: { value: string; label: string }) {
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

const SEGMENT_ICON: Record<RewardSegmentKey, LucideIcon> = {
  standard: User,
  premium: Crown,
  influencer: Megaphone,
  aura: Sparkles,
  // lucide-react-native has no Instagram glyph — Camera is what the mobile
  // place-detail story step already uses.
  story: Camera,
  welcome: DoorOpen,
  review: Star,
};

// Shorter than the ladder blurbs: the program card teaches, the pass reminds.
const CLAIM_HINT: Record<RewardSegmentKey, string> = {
  standard: 'Always on',
  premium: 'Always on',
  influencer: 'Always on',
  aura: 'Always on',
  story: 'Tag the place in a story',
  welcome: "At a place you haven't visited",
  review: 'Once per place',
};

// State A — what this guest can claim ANYWHERE. The pass can't know the venue
// before the scan, so this is entitlement, never a per-place quote. The rung
// set (including the v6 Influencer-only Story gate) comes from
// reachableSegments so eligibility has exactly one home.
export function ClaimBlock({ classKey }: { classKey: RewardClassKey }) {
  const mine = segmentKeyForClass(classKey);
  const rungs = reachableSegments(classKey);

  return (
    <View className="mt-4 border-t border-white/20 pt-4">
      <Text
        className="font-bold uppercase text-white/75"
        style={{ fontSize: 10, letterSpacing: 1.4 }}
      >
        What you can claim
      </Text>
      <View className="mt-2.5 gap-1.5">
        {rungs.map((seg) => {
          const Icon = SEGMENT_ICON[seg.key];
          const isMine = seg.key === mine;
          return (
            <View
              key={seg.key}
              className={`flex-row items-center gap-2.5 rounded-xl px-2.5 py-2 ${
                isMine ? 'bg-white/20' : 'bg-white/10'
              }`}
            >
              <View className="h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                <Icon color="#fff" size={15} />
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className="font-bold text-white"
                  numberOfLines={1}
                  style={{ fontSize: 12.5 }}
                >
                  {seg.name}
                </Text>
                <Text
                  className="text-white/75"
                  numberOfLines={1}
                  style={{ fontSize: 10.5 }}
                >
                  {isMine ? 'Your class · always on' : CLAIM_HINT[seg.key]}
                </Text>
              </View>
              <Text
                className="shrink-0 font-extrabold text-white"
                style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}
              >
                {seg.rates[PEAK_STRATEGY]}%
              </Text>
            </View>
          );
        })}
      </View>
      <Text className="mt-2 text-white/70" style={{ fontSize: 10.5 }}>
        You always keep your best one — never added together. The exact % is set
        by each place.
      </Text>
    </View>
  );
}

// State B — a visit is in flight, so the venue and its rate are known and the
// pass stops guessing: resolved discount, the one thing left to do, and a tap
// through to the ticket.
export function LiveStrip({ ticket }: { ticket: PassTicketView }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(rewardsTicketPath(ticket.ticketId))}
      accessibilityRole="button"
      className="mt-4 flex-row items-center gap-3 rounded-2xl border border-white/25 bg-white/20 px-3 py-3 active:opacity-90"
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/25">
        <Sparkles color="#fff" size={18} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="font-extrabold text-white"
          numberOfLines={1}
          style={{ fontSize: 13 }}
        >
          {ticket.discountPercent != null
            ? `${ticket.discountPercent}% off at ${ticket.placeName}`
            : `Visit open at ${ticket.placeName}`}
        </Text>
        <Text
          className="text-white/85"
          numberOfLines={1}
          style={{ fontSize: 11 }}
        >
          {ticket.pendingLabel ?? 'Nothing left to do — enjoy it'}
        </Text>
      </View>
      <ChevronRight color="rgba(255,255,255,0.7)" size={16} />
    </Pressable>
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
