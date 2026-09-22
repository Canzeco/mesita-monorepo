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
import { Gem } from 'lucide-react-native';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { formatCompactCount, phoneCountryFlag } from '@/lib/utils';

// ─── Me membership card (MESITA-932 / MESITA-935 / MESITA-937 / MESITA-2040)
// — web parity. Centered photo + IG/Diamond badges (IG leading/left —
// MESITA-956), then five equal-height identity rows: name·sex·age / phone / IG
// / Diamond / visits·saved. Phone shows dial flag.
// Typography: Fraunces only on MESITA wordmark; all identity rows = Inter.
//
// ONE METAL LEFT, AND IT MEANS ONE THING (MESITA-2040). `classBadgeColors` and
// `classBadgeIconColor` switched on four rungs — amber for aura, red for
// influencer, blue for premium, grey for the floor — and `isElevatedClass`
// decided whether the ring and the wash were coloured at all. There is no
// ladder: the ring, the wash and the badge carry DIAMOND, and a guest who is
// not Diamond gets the brand pink the card has always fallen back to.

const ROW_HEIGHT = 44;

/** Diamond's badge, and the only conditional colour on this card.
 *
 *  DIAMOND KEEPS ITS HUE, NOT-DIAMOND LOSES ITS PINK (MESITA-1954 +
 *  MESITA-2040). Diamond is a tier the product names out loud to the guest,
 *  which is the achromatic rule's "where a tier is named" clause exactly. The
 *  blue is spelled out here rather than read from `GRADIENTS.premium`, because
 *  that token went to an ink ramp when this app went achromatic — reading it
 *  would paint Diamond the same grey as everyone else. Everything the card
 *  showed a NOT-Diamond guest was brand pink, and pink is not a tier: the ring
 *  takes `GRADIENTS.pink` (an ink ramp now) and the wash takes that ink at the
 *  alphas the pink wash had. */
const DIAMOND_BADGE = ['#bfdbfe', '#2563eb'] as const;
const PLAIN_BADGE = ['#e5e7eb', '#9ca3af'] as const;
const PLAIN_WASH = ['rgba(23,23,23,0.10)', 'rgba(64,64,64,0.06)'] as const;

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
  diamond,
  name,
  sexLabel,
  age,
  phone,
  phoneRaw,
  avatarUrl,
  igConnected,
  handle,
  followers,
  diamondLabel,
  savedCents,
  visits,
}: {
  /** Invited, by hand. The card's only conditional colour. */
  diamond: boolean;
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
  /** "Diamond" or "Ask for it" — Me computes it from the shared facts. */
  diamondLabel: string;
  savedCents: number | null;
  visits: number | null;
}) {
  const router = useRouter();
  const diamondWash = ['rgba(37,99,235,0.16)', 'rgba(96,165,250,0.12)'] as const;

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
      key: 'diamond',
      href: CONSUMER_ROUTES.mePages.diamond,
      accessibilityLabel: `Diamond: ${diamondLabel}`,
      content: (
        <View className="flex-row items-center gap-1.5">
          <Gem
            color={diamond ? '#2563eb' : '#171717B3'}
            size={14}
            strokeWidth={2.25}
          />
          <Text
            className={
              diamond
                ? 'font-semibold text-foreground'
                : 'font-semibold text-muted-foreground'
            }
            style={{ fontSize: 13 }}
            numberOfLines={1}
          >
            {diamondLabel}
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
          diamond ? diamondWash : PLAIN_WASH
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
            colors={diamond ? [...DIAMOND_BADGE] : [...GRADIENTS.pink]}
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

          {/* Avatar sub-badges — equal 28px (MESITA-938). IG left / Diamond
              right, so Instagram leads on every surface (MESITA-956, and the
              order Pato named the two facts in MESITA-2040). */}
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
                  // Instagram fill, the third-party colour GRADIENTS.instagram
                  // carries on the ring above it. Disconnected is the neutral.
                  color={igConnected ? undefined : COLORS.mutedForeground}
                />
              )}
            </View>
          </LinearGradient>

          <LinearGradient
            colors={diamond ? [...DIAMOND_BADGE] : [...PLAIN_BADGE]}
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
            accessibilityLabel={`Diamond: ${diamondLabel}`}
          >
            <Gem
              color={diamond ? '#1e3a8a' : '#171717'}
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
