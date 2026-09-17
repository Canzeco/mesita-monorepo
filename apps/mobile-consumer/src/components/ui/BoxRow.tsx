import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { COLORS, GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { useReduceMotion } from '@/lib/useReduceMotion';

type BoxTint =
  | 'pink'
  | 'sky'
  | 'emerald'
  | 'violet'
  | 'amber'
  | 'muted'
  | 'premium'
  | 'destructive';

// Ports web ProfileClient BOX_TINT — one neutral tile per Me option-box icon.
//
// THE TINT AXIS IS COLLAPSED ON PURPOSE (MESITA-1954). It used to read
// sky/emerald/violet/amber against `muted` so the page "reads premium, never a
// flat gray stack". Achromatic, those four fills sit at 15–20% alpha and land
// within a couple of percent of `bg-muted` and of each other — so the honest
// move is to write the collapse down here rather than leave eight tint names
// that render as one thing. Web got to the same place first and by argument
// rather than by repaint (see apps/web-consumer me/profile-sections.tsx,
// MESITA-1132): seven accents in a vertical stack give seven rows equal
// emphasis, so nothing leads. Its chip is `bg-muted` + `text-foreground/70`,
// which is exactly what these two records now hold.
//
// The lucide glyph is what identifies a row. The `BoxTint` union is kept whole
// so no call site has to change, but only two members still carry meaning:
// `destructive` (danger — reserved hue) and the gradient tiles below.
const SOLID_TINT: Record<
  Exclude<BoxTint, 'pink' | 'premium'>,
  string
> = {
  sky: 'bg-muted',
  emerald: 'bg-muted',
  violet: 'bg-muted',
  amber: 'bg-muted',
  muted: 'bg-muted',
  // RESERVED: red is the one thing that says "this destroys something". It is
  // also the only tile that differs at all — note no call site passes
  // tint="destructive" today, so this is the repair path, not live pixels.
  destructive: 'bg-destructive/10',
};

const ICON_COLOR: Record<BoxTint, string> = {
  // The label on an ink gradient tile.
  pink: COLORS.primaryForeground,
  sky: COLORS.mutedForeground,
  emerald: COLORS.mutedForeground,
  violet: COLORS.mutedForeground,
  amber: COLORS.mutedForeground,
  // was rgba(38,4,9,0.7) — old ink at 70%, i.e. web's `text-foreground/70`,
  // which over a tile is this token. One value for all five decorative tints.
  muted: COLORS.mutedForeground,
  premium: COLORS.primaryForeground,
  // RESERVED: danger. Was #dc2626 (stock Tailwind red-600, never a Mesita
  // value); the token is what `bg-destructive/10` above already tints with.
  destructive: COLORS.destructive,
};

function TintedIconTile({
  tint,
  children,
  size = 44,
}: {
  tint: BoxTint;
  children: ReactNode;
  size?: number;
}) {
  const radius = 12; // web rounded-2xl on mobile scale
  if (tint === 'pink' || tint === 'premium') {
    return (
      <LinearGradient
        colors={tint === 'premium' ? [...GRADIENTS.premium] : [...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </LinearGradient>
    );
  }
  return (
    <View
      className={SOLID_TINT[tint]}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

function BoxShell({
  iconTint,
  icon,
  title,
  summary,
  onPress,
  disabled,
  soon = false,
}: {
  iconTint: BoxTint;
  icon: ReactNode;
  title: string;
  summary: string;
  onPress: () => void;
  disabled?: boolean;
  soon?: boolean;
}) {
  // Parked (soon) rows are BLOCKED, not removed — web parity. No Alert.
  const reduceMotion = useReduceMotion();
  const inert = Boolean(disabled || soon);
  return (
    <Pressable
      onPress={soon ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert }}
      accessibilityLabel={soon ? `${title}, coming soon` : `${title}. ${summary}`}
      style={({ pressed }) => [
        {
          opacity: inert ? 0.6 : pressed && !reduceMotion ? 0.92 : 1,
          transform: [
            {
              scale: pressed && !inert && !reduceMotion ? 0.99 : 1,
            },
          ],
        },
      ]}
      className="mb-2 min-h-[56px] flex-row items-center gap-3.5 rounded-2xl border border-border bg-card p-4"
    >
      <TintedIconTile tint={iconTint}>{icon}</TintedIconTile>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="font-bold text-foreground"
            style={{ fontSize: 15 }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {soon ? (
            <View className="rounded-full border border-border px-1.5 py-0.5">
              <Text
                className="font-semibold uppercase text-muted-foreground"
                style={{ fontSize: 8, letterSpacing: 1 }}
              >
                Soon
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          className="text-muted-foreground"
          style={{ fontSize: 12 }}
          numberOfLines={1}
        >
          {summary}
        </Text>
      </View>
      {!soon ? <ChevronRight color={COLORS.mutedForeground} size={16} /> : null}
    </Pressable>
  );
}

export function BoxRow({
  Icon,
  tint,
  title,
  summary,
  href,
  onPress,
  disabled,
  soon,
}: {
  Icon: LucideIcon;
  tint: BoxTint;
  title: string;
  summary: string;
  href?: Href;
  onPress?: () => void;
  disabled?: boolean;
  soon?: boolean;
}) {
  const router = useRouter();
  return (
    <BoxShell
      iconTint={tint}
      icon={<Icon color={ICON_COLOR[tint]} size={22} />}
      title={title}
      summary={summary}
      onPress={() => {
        if (href) router.push(href);
        else onPress?.();
      }}
      disabled={disabled}
      soon={soon}
    />
  );
}
