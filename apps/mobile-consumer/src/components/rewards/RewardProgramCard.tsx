import { LinearGradient } from 'expo-linear-gradient';
import {
  Camera,
  Crown,
  DoorOpen,
  Magnet,
  Star,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import { COLORS, GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import {
  PEAK_POSTURE,
  REWARD_SEGMENTS,
  baseRateForClass,
  peakRateForClass,
  segmentKeyForClass,
  type RewardClassKey,
  type RewardSegment,
  type RewardSegmentKey,
} from '@/lib/reward-segments';
import { useAuth } from '@/providers/auth';

// Rewards program card (web RewardProgramCard port, MESITA-723): a "max % for
// you" banner over the six-segment ladder, with the guest's own class rung
// marked "You". Program education, not a per-place quote.

const SEGMENT_ICON: Record<RewardSegmentKey, LucideIcon> = {
  standard: User,
  magnetic: Magnet,
  premium: Crown,
  story: Camera,
  welcome: DoorOpen,
  review: Star,
};

// Icon tile fill + glyph color per rung (mine → white on the gradient row).
function rungTint(
  seg: RewardSegment,
  mine: boolean,
): { bg: string; fg: string } {
  if (mine) return { bg: 'rgba(255,255,255,0.2)', fg: '#ffffff' };
  if (seg.key === 'premium' || seg.key === 'magnetic')
    return { bg: 'rgba(139,108,232,0.12)', fg: '#8b6ce8' };
  if (seg.kind === 'class')
    return { bg: 'rgba(251,43,123,0.1)', fg: COLORS.primary };
  return { bg: 'rgba(207,3,96,0.1)', fg: COLORS.secondary };
}

export function RewardProgramCard() {
  const { consumerClass } = useAuth();
  const classKey: RewardClassKey =
    consumerClass?.class === 'premium' ? 'premium' : 'free';
  const mineKey = segmentKeyForClass(classKey);
  const peak = peakRateForClass(classKey);
  const base = baseRateForClass(classKey);
  const isPremium = classKey === 'premium';

  const bannerSub = isPremium
    ? `Premium gives you a ${base}% base — climb to ${peak}% with a Google review at the table.`
    : `You start at ${base}% as Standard — go up to ${peak}% with Premium, stories and reviews.`;

  return (
    <View className="overflow-hidden rounded-[28px] border border-border bg-card">
      {/* Banner — "the max amount of reward you can get". */}
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22 }}
      >
        <Text
          className="font-bold uppercase text-white/80"
          style={{ fontSize: 10, letterSpacing: 1.4 }}
        >
          Your max reward
        </Text>
        <View className="mt-1 flex-row items-baseline" style={{ gap: 6 }}>
          <Text
            className="font-bold tracking-tight text-white"
            style={{ fontSize: 40, lineHeight: 42 }}
          >
            Up to {peak}%
          </Text>
          <Text
            className="font-semibold text-white/85"
            style={{ fontSize: 16 }}
          >
            off for you
          </Text>
        </View>
        <Text
          className="mt-2 text-white/90"
          style={{ fontSize: 12.5, lineHeight: 18 }}
        >
          {bannerSub}
        </Text>
      </LinearGradient>

      {/* Ladder — six rungs, worst→best, the guest's own rung highlighted. */}
      <View style={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 16, gap: 6 }}>
        <View className="flex-row items-baseline justify-between px-1 pb-1">
          <Text
            className="font-bold tracking-tight text-foreground"
            style={{ fontSize: 14 }}
          >
            Reward tiers
          </Text>
          <Text className="text-muted-foreground" style={{ fontSize: 11 }}>
            You keep your best one
          </Text>
        </View>

        {REWARD_SEGMENTS.map((seg) => (
          <RungRow key={seg.key} seg={seg} mine={seg.key === mineKey} />
        ))}

        <Text
          className="mt-2 px-1 text-muted-foreground/80"
          style={{ fontSize: 11, lineHeight: 15 }}
        >
          Tiers stack up to the best one you qualify for — never added together.
          Magnetic is invite-only. The exact % at each place shows on its page.
        </Text>
      </View>
    </View>
  );
}

function RungRow({ seg, mine }: { seg: RewardSegment; mine: boolean }) {
  const Icon = SEGMENT_ICON[seg.key];
  const peak = seg.rates[PEAK_POSTURE];
  const magneticLocked = seg.key === 'magnetic' && !mine;
  const tint = rungTint(seg, mine);
  const filled = seg.key === 'premium' || seg.key === 'review';

  const inner = (
    <View
      className="flex-row items-center px-3 py-2.5"
      style={{ gap: 12, opacity: magneticLocked ? 0.6 : 1 }}
    >
      <View
        className="items-center justify-center rounded-xl"
        style={{ width: 36, height: 36, backgroundColor: tint.bg }}
      >
        <Icon
          color={tint.fg}
          size={18}
          strokeWidth={2}
          {...(filled ? { fill: tint.fg } : {})}
        />
      </View>

      <View className="min-w-0 flex-1">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text
            numberOfLines={1}
            className="font-bold"
            style={{ fontSize: 13.5, color: mine ? '#ffffff' : COLORS.foreground }}
          >
            {seg.name}
          </Text>
          {mine ? (
            <View
              className="rounded-full"
              style={{
                backgroundColor: 'rgba(255,255,255,0.25)',
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                className="font-extrabold uppercase text-white"
                style={{ fontSize: 9, letterSpacing: 1 }}
              >
                You
              </Text>
            </View>
          ) : magneticLocked ? (
            <View
              className="rounded-full"
              style={{
                backgroundColor: 'rgba(139,108,232,0.12)',
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                className="font-bold uppercase"
                style={{ fontSize: 9, letterSpacing: 0.5, color: '#8b6ce8' }}
              >
                Invite only
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          className={mine ? 'text-white/85' : 'text-muted-foreground'}
          style={{ fontSize: 11.5, marginTop: 2 }}
        >
          {seg.blurb}
        </Text>
      </View>

      <Text
        className="font-extrabold"
        style={{
          fontSize: 17,
          color: mine ? '#ffffff' : 'rgba(38,4,9,0.8)',
        }}
      >
        {peak}%
      </Text>
    </View>
  );

  if (mine) {
    return (
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{ borderRadius: 16 }}
      >
        {inner}
      </LinearGradient>
    );
  }
  return (
    <View className="rounded-2xl border border-border/50 bg-muted/40">
      {inner}
    </View>
  );
}
