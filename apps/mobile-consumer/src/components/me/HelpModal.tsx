// Help — the education home for the reward program (MESITA-809), mobile
// mirror of web HelpModal: how rewards work + the seven-rung tier ladder.
// Lives on Me, not on Rewards: the wallet is for doing, this is for
// understanding. Opened from the Me > Help row.

import type { LucideIcon } from 'lucide-react-native';
import {
  Camera,
  Crown,
  DoorOpen,
  Megaphone,
  Percent,
  Sparkles,
  Star,
  User,
} from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import {
  PEAK_STRATEGY,
  REWARD_SEGMENTS,
  segmentKeyForClass,
  type RewardSegmentKey,
} from '@/lib/reward-segments';
import { useAuth } from '@/providers/auth';

const SEGMENT_ICON: Record<RewardSegmentKey, LucideIcon> = {
  standard: User,
  premium: Crown,
  influencer: Megaphone,
  aura: Sparkles,
  story: Camera,
  welcome: DoorOpen,
  review: Star,
};

function ExplainRow({
  icon,
  bold,
  rest,
}: {
  icon: React.ReactNode;
  bold: string;
  rest: string;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-secondary/10">
        {icon}
      </View>
      <Text
        className="flex-1 text-muted-foreground"
        style={{ fontSize: 13, lineHeight: 20 }}
      >
        <Text className="font-semibold text-foreground">{bold} </Text>
        {rest}
      </Text>
    </View>
  );
}

export function HelpModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { consumerClass } = useAuth();
  const key = consumerClass?.class ?? 'standard';
  const mine = segmentKeyForClass(key);

  return (
    <FullScreenSheet visible={visible} onClose={onClose} title="Help"
      subtitle="How rewards work">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <ExplainRow
          icon={<Percent size={18} color="#cf0360" />}
          bold="Instant discounts."
          rest="Start a ticket, show its QR at the table — the discount comes straight off the bill. Mesita never holds your money."
        />
        <ExplainRow
          icon={<Crown size={18} color="#ce74e3" fill="#ce74e3" />}
          bold="Elevated classes boost them."
          rest="Bronze gets the base discount; Gold, Silver and Diamond unlock bigger ones — Silver is free with Instagram reach, Diamond is invite-only."
        />
        <ExplainRow
          icon={<Sparkles size={18} color="#cf0360" />}
          bold="Actions beat your class."
          rest="A first visit, a Google review, or an Instagram story (with Instagram connected) can pay more than your class rate. You always keep your single best one, never a sum."
        />

        {/* The ladder */}
        <View style={{ gap: 6 }}>
          <View className="flex-row items-baseline justify-between px-1 pb-1">
            <Text className="font-display font-bold text-foreground" style={{ fontSize: 14 }}>
              Reward tiers
            </Text>
            <Text className="text-muted-foreground" style={{ fontSize: 11 }}>
              You keep your best one
            </Text>
          </View>
          {REWARD_SEGMENTS.map((seg) => {
            const Icon = SEGMENT_ICON[seg.key];
            const isMine = seg.key === mine;
            return (
              <View
                key={seg.key}
                className={`flex-row items-center gap-2.5 rounded-xl px-2.5 py-2 ${
                  isMine ? '' : 'bg-muted/40'
                }`}
                style={isMine ? { backgroundColor: '#e91f64' } : undefined}
              >
                <View
                  className={`h-7 w-7 items-center justify-center rounded-lg ${
                    isMine ? 'bg-white/20' : 'bg-secondary/10'
                  }`}
                >
                  <Icon size={14} color={isMine ? '#fff' : '#cf0360'} />
                </View>
                <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
                  <Text
                    className={`font-bold ${isMine ? 'text-white' : 'text-foreground'}`}
                    numberOfLines={1}
                    style={{ fontSize: 12.5 }}
                  >
                    {seg.name}
                  </Text>
                  {isMine ? (
                    <View className="rounded-full bg-white/25 px-1.5 py-0.5">
                      <Text
                        className="font-extrabold uppercase text-white"
                        style={{ fontSize: 8.5, letterSpacing: 1 }}
                      >
                        You
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  className={`font-extrabold ${isMine ? 'text-white' : 'text-foreground/80'}`}
                  style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}
                >
                  {seg.rates[PEAK_STRATEGY]}%
                </Text>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </FullScreenSheet>
  );
}
