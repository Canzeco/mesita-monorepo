// lucide-react-native has no Instagram glyph — AtSign is the house IG mark.
import {
  AtSign,
  DoorOpen,
  Star,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import { classProperLabel } from '@/lib/consumer-classes';
import type { PlaceStrategy } from '@/lib/promo-rates';
import {
  REWARD_SEGMENT_BY_KEY,
  segmentKeyForClass,
  type RewardClassKey,
} from '@/lib/reward-segments';

// One numbered step in the "How it works" sequence. The badge carries the
// step number, or a ✓ once the step is already satisfied (e.g. "Pick place"
// on the place's own page).
export function RewardStep({
  n,
  icon: Icon,
  title,
  body,
  accent,
  done = false,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  body: string;
  accent?: boolean;
  done?: boolean;
}) {
  return (
    <View className="flex-row gap-3">
      <View
        className={`relative mt-0.5 size-7 items-center justify-center rounded-full ${
          accent ? 'bg-violet-500/10' : 'bg-pink-500/10'
        }`}
      >
        <Icon color={accent ? '#8b6ce8' : '#fb2b7b'} size={14} strokeWidth={2} />
        <View
          className={`absolute -top-1 -right-1 size-4 items-center justify-center rounded-full ${
            done ? 'bg-emerald-500' : 'bg-foreground'
          }`}
        >
          <Text
            className={`text-[9px] font-bold ${done ? 'text-white' : 'text-background'}`}
          >
            {done ? '✓' : n}
          </Text>
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

// ── Your rewards at THIS place (v7, MESITA-861) ─────────────────────────
//
// The guest's own row of the big Strategy × Class table, action by action,
// at the place's strategy. Replaces the Standard-vs-Premium comparison: the
// guest sees what THEY can get here, never class arithmetic (MESITA-860).

type Row = {
  Icon: LucideIcon;
  label: string;
  hint: string;
  /** null = show ★ (the Mesita review, unpriced today); number = percent. */
  value: number | null;
  mine?: boolean;
};

export function YourRewardsHere({
  strategy,
  classKey,
}: {
  strategy: PlaceStrategy;
  classKey: RewardClassKey;
}) {
  const mine = REWARD_SEGMENT_BY_KEY[segmentKeyForClass(classKey)];

  const rows: Row[] = [
    {
      Icon: User,
      label: `${classProperLabel(classKey)} — always on`,
      hint: 'Your standing discount, every visit',
      value: mine.rates[strategy],
      mine: true,
    },
    {
      Icon: UtensilsCrossed,
      label: 'Mesita review',
      hint: 'Rate it in the app — feeds its rating',
      value: null,
    },
    {
      Icon: AtSign,
      label: 'Instagram story',
      hint: 'Tag the place — any connected Instagram',
      value: REWARD_SEGMENT_BY_KEY.story.rates[strategy],
    },
    {
      Icon: DoorOpen,
      label: 'Welcome visit',
      hint: 'Automatic on your first visit here',
      value: REWARD_SEGMENT_BY_KEY.welcome.rates[strategy],
    },
    {
      Icon: Star,
      label: 'Google review',
      hint: 'At the table, once per place',
      value: REWARD_SEGMENT_BY_KEY.review.rates[strategy],
    },
  ];

  return (
    <View style={{ gap: 6 }}>
      {rows.map((r) => (
        <View
          key={r.label}
          className={`flex-row items-center rounded-xl px-2.5 py-2 ${
            r.mine ? 'bg-primary/10' : 'bg-muted/50'
          }`}
          style={{ gap: 10 }}
        >
          <View
            className={`size-8 items-center justify-center rounded-lg ${
              r.mine ? 'bg-primary/10' : 'bg-secondary/10'
            }`}
          >
            <r.Icon size={16} color="#cf0360" strokeWidth={2.25} />
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Text
                className="font-bold text-foreground"
                numberOfLines={1}
                style={{ fontSize: 12.5, flexShrink: 1 }}
              >
                {r.label}
              </Text>
              {r.mine ? (
                <View className="rounded-full bg-primary/10 px-1.5 py-0.5">
                  <Text
                    className="font-extrabold uppercase text-primary"
                    style={{ fontSize: 8.5, letterSpacing: 1 }}
                  >
                    You
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              className="mt-0.5 text-muted-foreground"
              numberOfLines={1}
              style={{ fontSize: 11 }}
            >
              {r.hint}
            </Text>
          </View>
          <Text
            className="font-extrabold text-foreground"
            style={{ fontSize: 15 }}
          >
            {r.value == null ? '★' : `${r.value}%`}
          </Text>
        </View>
      ))}
      <Text
        className="mt-1 px-1 text-muted-foreground"
        style={{ fontSize: 10.5, lineHeight: 14 }}
      >
        You always keep your single best one — never added together.
      </Text>
    </View>
  );
}
