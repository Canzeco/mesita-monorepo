// lucide-react-native has no Instagram glyph — AtSign is the house IG mark.
import {
  AtSign,
  DoorOpen,
  Gem,
  Star,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import { COLORS } from '@/constants/brand';
import type { PlaceStrategy } from '@/lib/promo-rates';
import {
  identityRateRowsAt,
  REWARD_SEGMENT_BY_KEY,
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
      {/* The accent step (the one that actually pays) was marked by hue alone:
          a violet tint against a pink one, a blue glyph against the brand
          pink. Achromatic, that is four identical circles — so the mark moves
          to lightness and stroke weight, which survive the greyscale. */}
      <View
        className={`relative mt-0.5 size-7 items-center justify-center rounded-full ${
          accent ? 'bg-foreground/10' : 'bg-muted'
        }`}
      >
        <Icon
          color={accent ? COLORS.foreground : COLORS.mutedForeground}
          size={14}
          strokeWidth={accent ? 2.5 : 2}
        />
        {/* done vs pending: the ✓ / number glyph below is the real carrier —
            never "simplify" it away. The fill only backs it up. */}
        <View
          className={`absolute -top-1 -right-1 size-4 items-center justify-center rounded-full ${
            done ? 'bg-muted-foreground' : 'bg-foreground'
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

// ── Your rewards at THIS place (v7, MESITA-861; MESITA-2044) ────────────
//
// The guest's rewards at the place's strategy, action by action. Who the
// guest is takes exactly TWO rows — Base (every guest) and Diamond (the
// adder on top, invitation only) — and the guest's own one carries "You".
// There is no ladder to show (Pato, MESITA-2044).

type Row = {
  Icon: LucideIcon;
  label: string;
  hint: string;
  /** null = show ★ (the Mesita review, unpriced today); string = as shown. */
  value: string | null;
  mine?: boolean;
};

/** "Your rate" — the two identity rows and nothing else: Base (N%) and the
 *  the Diamond adder (+N%), the guest's own one marked "You". */
export function YourRate({
  strategy,
  classKey,
}: {
  strategy: PlaceStrategy;
  classKey: RewardClassKey;
}) {
  const rows: Row[] = identityRateRowsAt(strategy, classKey).map((r) => ({
    Icon: r.key === 'diamond' ? Gem : Store,
    label: r.label,
    hint: r.hint,
    value: r.display,
    mine: r.mine,
  }));
  return <RewardRows rows={rows} />;
}

/** The actions at this place — every guest, Diamond or not. */
export function YourRewardsHere({ strategy }: { strategy: PlaceStrategy }) {
  const rows: Row[] = [
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
      value: `${REWARD_SEGMENT_BY_KEY.story.rates[strategy]}%`,
    },
    {
      Icon: DoorOpen,
      label: 'Welcome visit',
      hint: 'Automatic on your first visit here',
      value: `${REWARD_SEGMENT_BY_KEY.welcome.rates[strategy]}%`,
    },
    {
      Icon: Star,
      label: 'Google review',
      hint: 'At the table, once per place',
      value: `${REWARD_SEGMENT_BY_KEY.review.rates[strategy]}%`,
    },
  ];
  return (
    <View style={{ gap: 6 }}>
      <RewardRows rows={rows} />
      <Text
        className="mt-1 px-1 text-muted-foreground"
        style={{ fontSize: 10.5, lineHeight: 14 }}
      >
        You always keep your single best one — never added together.
      </Text>
    </View>
  );
}

function RewardRows({ rows }: { rows: Row[] }) {
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
          {/* One tile tint for every row: `mine` is carried by the row's own
              fill above and by the "You" pill below, never by this. */}
          <View className="size-8 items-center justify-center rounded-lg bg-foreground/10">
            <r.Icon size={16} color={COLORS.secondary} strokeWidth={2.25} />
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
            {r.value == null ? '★' : r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
