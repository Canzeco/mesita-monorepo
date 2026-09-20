import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChannelMark } from '@/components/brand/channel-marks';
import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import {
  COLORS,
  GRADIENT_DIAGONAL,
  GRADIENTS,
  SHADOW_ELEV,
} from '@/constants/brand';
import { formatCurrency } from '@/lib/api/pay';
import {
  CLASS_ICONS,
  CLASS_METAL_INK_GRADIENT,
  isElevatedClass,
} from '@/lib/consumer-classes';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { formatCompactCount, phoneCountryFlag } from '@/lib/utils';

// ─── Me membership card (MESITA-932 / MESITA-935 / MESITA-937) — web parity.
// Centered photo + IG/Class badges (IG leading/left — MESITA-956), then five
// equal-height identity rows: name·sex·age / phone / IG / class / visits·saved.
// Phone shows dial flag; class row + badge use CLASS_ICONS.
// Typography: Fraunces only on MESITA wordmark; all identity rows = Inter.

const ROW_HEIGHT = 44;

// THE CLASS LADDER keeps its hue (MESITA-1954): a tier the product names out
// loud to the guest is one of the three things chroma survives for. What it
// stops doing is naming its own metal — CLASS_METAL_INK_GRADIENT is the one
// map the ring and the wash below also take, so badge, ring and wash cannot
// name different metals for one class.
//
// THIS FILE USED TO HAND-ROLL THE BRIDGE ITSELF, matching on key NAME rather
// than on meaning (`aura: GRADIENTS.gold` reads as a deliberate choice but is
// really "aura and gold are both four letters starting with a vowel or not" —
// GRADIENTS.gold is Gold's own ink, and aura is Diamond). Every class on this
// screen rendered the wrong metal until this pointed at the canonical map.
function classBadgeColors(classKey: string): readonly [string, string] {
  return (
    CLASS_METAL_INK_GRADIENT[classKey as keyof typeof CLASS_METAL_INK_GRADIENT]
    ?? CLASS_METAL_INK_GRADIENT.standard
  );
}

// The ink ON the metal, at the ink-anchor scale (measured, not eyeballed —
// contrast() run against both stops of each metal's ring gradient, worst case
// kept). Bronze and Diamond are dark enough here to carry white (3.94:1,
// 3.60:1); Silver and Gold are not (2.98:1, 3.20:1) and take foreground ink
// instead (3.68:1, 3.66:1). This is the ink-anchor scale, one step darker
// than the badge FILL scale passport.tsx uses — the two pairings differ on
// purpose; don't copy one onto the other.
function classBadgeIconColor(classKey: string): string {
  if (classKey === 'aura') return COLORS.primaryForeground; // Diamond
  if (classKey === 'influencer') return COLORS.foreground; // Silver
  if (classKey === 'premium') return COLORS.foreground; // Gold
  return COLORS.primaryForeground; // Bronze
}

export function IdentityHeroSkeleton() {
  return (
    <View className="w-full overflow-hidden rounded-2xl border border-border bg-muted/50 px-4 py-4">
      <View className="items-center gap-3">
        <View className="h-2.5 w-16 rounded bg-muted" />
        <View className="h-[72px] w-[72px] rounded-full bg-muted" />
        <View className="w-full overflow-hidden rounded-xl bg-muted/80">
          {Array.from({ length: 5 }).map((_, i) => (
            <View
              key={i}
              className="items-center justify-center border-b border-border/60"
              style={{ height: ROW_HEIGHT }}
            >
              <View className="h-3 w-28 rounded bg-muted" />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function IdentityHero({
  classKey,
  name,
  sexLabel,
  age,
  phone,
  phoneRaw,
  avatarUrl,
  igConnected,
  handle,
  followers,
  classLabel,
  savedCents,
  visits,
}: {
  classKey: string;
  name: string;
  sexLabel: string | null;
  age: number | null;
  phone: string | null;
  /** Raw E.164 digits for flag lookup (MESITA-935). */
  phoneRaw?: string | null;
  avatarUrl?: string | null;
  igConnected: boolean;
  handle: string | null;
  followers: number;
  classLabel: string;
  savedCents: number | null;
  visits: number | null;
}) {
  const router = useRouter();
  const isElevated = isElevatedClass(classKey);
  // ONE MAP (MESITA-1954): this used to match on key NAME the same wrong way
  // classBadgeColors above did — aura->gold, influencer->influencer,
  // else->premium — which named the wrong metal for all three elevated
  // classes. `standard` is unreachable here (isElevated excludes it) but the
  // map covers it too, so there is nothing left to get wrong by omission.
  const elevatedRing =
    CLASS_METAL_INK_GRADIENT[classKey as keyof typeof CLASS_METAL_INK_GRADIENT]
    ?? CLASS_METAL_INK_GRADIENT.standard;
  // The tier wash = the same metal as the ring above, at the alpha it had.
  // Keyed correctly now: aura->Diamond's rgb(0,144,201), influencer->Silver's
  // rgb(154,148,148), premium->Gold's rgb(184,136,10) — the ring's own three
  // ink-anchor stops, decimal, not re-derived.
  const elevatedWash =
    classKey === 'aura'
      ? (['rgba(0,144,201,0.16)', 'rgba(0,114,160,0.10)'] as const)
      : classKey === 'influencer'
        ? (['rgba(154,148,148,0.16)', 'rgba(117,112,112,0.10)'] as const)
        : (['rgba(184,136,10,0.18)', 'rgba(144,107,0,0.10)'] as const);

  const identityLine = [name, sexLabel, age != null ? String(age) : null]
    .filter(Boolean)
    .join(' · ');
  const igLine = igConnected
    ? [handle ? `@${handle}` : 'Connected', formatCompactCount(followers)]
        .filter(Boolean)
        .join(' · ')
    : 'Instagram not connected';
  const metricsLine = [
    visits == null ? '— visits' : `${visits} visits`,
    savedCents == null ? '— saved' : `${formatCurrency(savedCents)} saved`,
  ].join(' · ');

  const flag = phoneCountryFlag(phoneRaw ?? phone);
  const classId = (
    Object.hasOwn(CLASS_ICONS, classKey)
      ? classKey
      : 'standard'
  ) as keyof typeof CLASS_ICONS;
  const ClassIcon = CLASS_ICONS[classId];

  const rows: {
    key: string;
    content: ReactNode;
    tone?: 'muted' | 'secondary';
    href?: string;
    accessibilityLabel?: string;
  }[] = [
    {
      key: 'identity',
      content: (
        <Text
          className="font-bold tracking-tight text-foreground"
          style={{ fontSize: 15 }}
          numberOfLines={1}
        >
          {identityLine}
        </Text>
      ),
    },
    {
      key: 'phone',
      tone: phone ? undefined : 'muted',
      content: (
        <View className="flex-row items-center gap-1.5">
          {flag ? (
            <Text style={{ fontSize: 14 }} accessibilityElementsHidden>
              {flag}
            </Text>
          ) : null}
          <Text
            className={
              phone
                ? 'font-semibold text-foreground'
                : 'font-semibold text-muted-foreground'
            }
            style={{
              fontSize: 13,
              fontVariant: ['tabular-nums'],
              letterSpacing: 0.4,
            }}
            numberOfLines={1}
          >
            {phone || '—'}
          </Text>
        </View>
      ),
    },
    {
      key: 'instagram',
      tone: igConnected ? 'secondary' : 'muted',
      href: CONSUMER_ROUTES.mePages.instagram,
      accessibilityLabel: `Instagram: ${igLine}`,
      content: (
        <Text
          className={
            igConnected
              ? 'font-semibold text-foreground'
              : 'font-semibold text-muted-foreground'
          }
          style={{ fontSize: 13 }}
          numberOfLines={1}
        >
          {igLine}
        </Text>
      ),
    },
    {
      key: 'class',
      href: CONSUMER_ROUTES.mePages.class,
      accessibilityLabel: `Class: ${classLabel}`,
      content: (
        <View className="flex-row items-center gap-1.5">
          <ClassIcon color="#171717B3" size={14} strokeWidth={2.25} />
          <Text
            className="font-semibold text-foreground"
            style={{ fontSize: 13 }}
            numberOfLines={1}
          >
            {classLabel}
          </Text>
        </View>
      ),
    },
    {
      key: 'metrics',
      content: (
        <Text
          className="font-semibold text-foreground"
          style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
        >
          {metricsLine}
        </Text>
      ),
    },
  ];

  return (
    <View
      accessibilityLabel="Your Mesita passport"
      className="w-full overflow-hidden rounded-2xl border border-border px-4 py-4"
      style={SHADOW_ELEV}
    >
      <LinearGradient
        colors={
          isElevated
            ? elevatedWash
            // Standard/Bronze wears its OWN metal. This was silver's rgb
            // (154,148,148) — the same "matched the wrong metal by habit"
            // slip as the ring below, just carried one level further, since
            // CLASS_METAL_INK_GRADIENT.standard didn't exist yet when this
            // was authored. Bronze's own ink-anchor light stop, rgb(180,112,63).
            : ['rgba(180,112,63,0.12)', 'rgba(149,76,40,0.08)']
        }
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      />

      <View className="items-center">
        <Text
          className="font-display-bold uppercase text-foreground/35"
          style={{ fontSize: 10, letterSpacing: 2.8 }}
        >
          Mesita
        </Text>

        <View
          className="relative mt-3 shrink-0"
          style={{ width: 72, height: 72, overflow: 'visible' }}
        >
          <LinearGradient
            // Non-elevated = Standard/Bronze's own metal, from the same
            // canonical map its badge below and CurrentClassCard both read —
            // CLASS_METAL_INK_GRADIENT.standard, not silver's or the Plan's
            // ink ramp.
            colors={isElevated ? elevatedRing : [...CLASS_METAL_INK_GRADIENT.standard]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{ borderRadius: 999, padding: 2 }}
          >
            <View className="rounded-full bg-card p-[2px]">
              <View className="h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-muted">
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    accessibilityLabel={name}
                  />
                ) : (
                  <DefaultAvatar size={72} />
                )}
              </View>
            </View>
          </LinearGradient>

          {/* Avatar sub-badges — equal 28px (MESITA-938). IG left / Class
              right so Instagram leads Class everywhere (MESITA-956).
              Instagram's gradient and its mark keep Instagram's colour — a
              third party owns it (MESITA-1954); not-connected is the flat
              hairline neutral, so the two states are colour vs no colour. */}
          <LinearGradient
            colors={
              igConnected
                ? [...GRADIENTS.instagram]
                : ([COLORS.border, COLORS.border] as const)
            }
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              position: 'absolute',
              left: -4,
              bottom: -4,
              width: 28,
              height: 28,
              borderRadius: 999,
              padding: 2,
              borderWidth: 2,
              borderColor: COLORS.card,
            }}
            accessibilityLabel={
              igConnected
                ? 'Instagram connected'
                : 'Instagram not connected'
            }
          >
            <View className="h-full w-full items-center justify-center overflow-hidden rounded-full bg-card">
              {igConnected && avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <ChannelMark
                  channel="instagram"
                  size={14}
                  // Connected: no override — ChannelMark's own canonical
                  // Instagram brand fill (#E4405F, channel-marks.tsx
                  // BRAND_COLOR.instagram), the same third-party colour
                  // GRADIENTS.instagram carries on the ring above it. The
                  // old literal here was '#c02670', a Mesita-pink-family
                  // magenta that predates the achromatic repaint and never
                  // matched Instagram's actual brand hex — a missed colour,
                  // not a reserved one. Disconnected stays the achromatic
                  // neutral token.
                  color={igConnected ? undefined : COLORS.mutedForeground}
                />
              )}
            </View>
          </LinearGradient>

          <LinearGradient
            colors={[...classBadgeColors(classKey)]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 28,
              height: 28,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: COLORS.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel={`Class: ${classLabel}`}
          >
            <ClassIcon
              color={classBadgeIconColor(classKey)}
              size={14}
              strokeWidth={2.5}
            />
          </LinearGradient>
        </View>

        <View
          accessibilityLabel="Your identity"
          className="mt-4 w-full overflow-hidden rounded-xl border border-border/80 bg-card/55"
        >
          {rows.map((row, i) => {
            const rowClass =
              i < rows.length - 1
                ? 'items-center justify-center border-b border-border/70 px-3'
                : 'items-center justify-center px-3';
            if (row.href) {
              return (
                <Pressable
                  key={row.key}
                  onPress={() => router.push(row.href!)}
                  accessibilityRole="button"
                  accessibilityLabel={row.accessibilityLabel}
                  className={rowClass}
                  style={{ height: ROW_HEIGHT }}
                >
                  {row.content}
                </Pressable>
              );
            }
            return (
              <View
                key={row.key}
                className={rowClass}
                style={{ height: ROW_HEIGHT }}
              >
                {row.content}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
