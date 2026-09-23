// Help — the education home for the reward program (MESITA-809), mobile
// mirror of web HelpModal. Lives on Me, not on Rewards: the wallet is for
// doing, this is for understanding. Opened from the Me > Help row.
//
// Numbers never live here (web, MESITA-1017): a static ladder quoted
// Aggressive defaults as if they were every place's bill. The live rates sit
// on each place's Rewards tab; this list is what is priced, named.
//
// TWO IDENTITY ROWS (MESITA-2044): Base and Diamond. No metals, no
// ladder — "either you are diamond or you are not".

import type { LucideIcon } from 'lucide-react-native';
import {
  AtSign,
  DoorOpen,
  Gem,
  Percent,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { COLORS } from '@/constants/brand';
import { isDiamond } from '@/lib/consumer-classes';
import {
  BASE_RATE_HINT,
  BASE_RATE_LABEL,
  DIAMOND,
  DIAMOND_HELP_LINE,
  DIAMOND_RATE_HINT,
} from '@/lib/consumer-identity';
import { useAuth } from '@/providers/auth';

type HelpRung = {
  key: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
  mine: boolean;
};

/** Everything PRICED, in engine order: Base, Diamond, Welcome, then
 *  the three sharing actions. The guest's own identity row wears You.
 *  Exported for the copy test. */
export function helpRungs(classKey: string): HelpRung[] {
  const onList = isDiamond(classKey);
  return [
    { key: 'base', label: BASE_RATE_LABEL, hint: BASE_RATE_HINT, Icon: Store, mine: !onList },
    { key: 'diamond', label: DIAMOND, hint: DIAMOND_RATE_HINT, Icon: Gem, mine: onList },
    { key: 'welcome', label: 'Welcome', hint: 'First visit only', Icon: DoorOpen, mine: false },
    // lucide-react-native has no Instagram glyph — AtSign is the house IG mark.
    { key: 'story', label: 'Instagram Story', hint: 'Needs a connected handle', Icon: AtSign, mine: false },
    { key: 'google', label: 'Google Review', hint: 'Once per place', Icon: Star, mine: false },
    { key: 'mesita', label: 'Mesita Review', hint: 'In the app, once per place', Icon: UtensilsCrossed, mine: false },
  ];
}

function ExplainRow({
  icon,
  bold,
  rest,
}: {
  icon: React.ReactNode;
  bold?: string;
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
        {bold ? (
          <Text className="font-semibold text-foreground">{bold} </Text>
        ) : null}
        {rest}
      </Text>
    </View>
  );
}

export function HelpModal({
  visible,
  onClose,
  asRoute = false,
}: {
  visible: boolean;
  onClose: () => void;
  asRoute?: boolean;
}) {
  const { consumerClass } = useAuth();
  const rows = helpRungs(consumerClass?.class ?? 'standard');

  return (
    <FullScreenSheet visible={visible} onClose={onClose} asRoute={asRoute} title="Help"
      subtitle="How rewards work">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <ExplainRow
          icon={<Percent size={18} color={COLORS.secondary} />}
          bold="Instant discounts."
          rest="Start a ticket, show its QR at the table — the discount comes straight off the bill. Mesita never holds your money."
        />
        <ExplainRow
          icon={<Gem size={18} color={COLORS.secondary} />}
          rest={DIAMOND_HELP_LINE}
        />
        <ExplainRow
          icon={<Sparkles size={18} color={COLORS.secondary} />}
          bold="Actions can pay more."
          rest="A first visit, a Google review, or an Instagram story (with Instagram connected) can pay more than your base. You always keep your single best one, never a sum. Live percents sit on each place's Rewards tab."
        />

        <View style={{ gap: 6 }}>
          <View className="flex-row items-baseline justify-between px-1 pb-1">
            <Text className="font-display font-bold text-foreground" style={{ fontSize: 14 }}>
              {"Everything that's priced"}
            </Text>
            <Text className="text-muted-foreground" style={{ fontSize: 11 }}>
              You keep your best one
            </Text>
          </View>
          {rows.map((seg) => {
            const Icon = seg.Icon;
            const isMine = seg.mine;
            return (
              <View
                key={seg.key}
                className={`flex-row items-center gap-2.5 rounded-xl px-2.5 py-2 ${
                  isMine ? '' : 'bg-muted/40'
                }`}
                style={isMine ? { backgroundColor: COLORS.primary } : undefined}
              >
                <View
                  className={`h-7 w-7 items-center justify-center rounded-lg ${
                    isMine ? 'bg-white/20' : 'bg-secondary/10'
                  }`}
                >
                  <Icon
                    size={14}
                    color={isMine ? COLORS.primaryForeground : COLORS.secondary}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text
                      className={`font-bold ${isMine ? 'text-white' : 'text-foreground'}`}
                      numberOfLines={1}
                      style={{ fontSize: 12.5 }}
                    >
                      {seg.label}
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
                  {seg.hint ? (
                    <Text
                      className={isMine ? 'text-white/80' : 'text-muted-foreground'}
                      numberOfLines={1}
                      style={{ fontSize: 11 }}
                    >
                      {seg.hint}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </FullScreenSheet>
  );
}
