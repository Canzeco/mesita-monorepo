import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ChannelMark } from '@/components/brand/channel-marks';
import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { formatCurrency } from '@/lib/api/pay';
import { CLASS_ICONS, isElevatedClass } from '@/lib/consumer-classes';
import { formatCompactCount, phoneCountryFlag } from '@/lib/utils';

// ─── Me membership card (MESITA-932 / MESITA-935 / MESITA-937) — web parity.
// Centered photo + IG/Class badges (IG leading/left — MESITA-956), then five
// equal-height identity rows: name·sex·age / phone / IG / class / visits·saved.
// Phone shows dial flag; class row + badge use CLASS_ICONS.
// Typography: Fraunces only on MESITA wordmark; all identity rows = Inter.

const ROW_HEIGHT = 44;

function classBadgeColors(classKey: string): readonly [string, string] {
  if (classKey === 'aura') return ['#fde68a', '#fb923c'] as const;
  if (classKey === 'influencer') return ['#fecaca', '#ef4444'] as const;
  if (classKey === 'premium') return ['#bfdbfe', '#2563eb'] as const;
  return ['#e5e7eb', '#9ca3af'] as const;
}

function classBadgeIconColor(classKey: string): string {
  if (classKey === 'aura') return '#78350f';
  if (classKey === 'influencer') return '#7f1d1d';
  if (classKey === 'premium') return '#1e3a8a';
  return '#171717';
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
  const isElevated = isElevatedClass(classKey);
  const elevatedRing =
    classKey === 'aura'
      ? GRADIENTS.gold
      : classKey === 'influencer'
        ? GRADIENTS.influencer
        : GRADIENTS.premium;
  const elevatedWash =
    classKey === 'aura'
      ? (['rgba(245,204,88,0.18)', 'rgba(235,136,31,0.10)'] as const)
      : classKey === 'influencer'
        ? (['rgba(239,68,68,0.16)', 'rgba(185,28,28,0.10)'] as const)
        : (['rgba(37,99,235,0.16)', 'rgba(96,165,250,0.12)'] as const);

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
      content: (
        <Text
          className={
            igConnected
              ? 'font-semibold text-secondary'
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
      content: (
        <View className="flex-row items-center gap-1.5">
          <ClassIcon color="#260409B3" size={14} strokeWidth={2.25} />
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
            : ['rgba(251,43,123,0.12)', 'rgba(255,90,171,0.08)']
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
            colors={isElevated ? elevatedRing : [...GRADIENTS.pink]}
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
              right so Instagram leads Class everywhere (MESITA-956). */}
          <LinearGradient
            colors={
              igConnected
                ? [...GRADIENTS.instagram]
                : (['#ebd9db', '#ebd9db'] as const)
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
              borderColor: '#fff',
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
                  color={igConnected ? '#c02670' : '#775254'}
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
              borderColor: '#fff',
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
          className="mt-4 w-full overflow-hidden rounded-xl border border-border/80 bg-white/55"
        >
          {rows.map((row, i) => (
            <View
              key={row.key}
              className={
                i < rows.length - 1
                  ? 'items-center justify-center border-b border-border/70 px-3'
                  : 'items-center justify-center px-3'
              }
              style={{ height: ROW_HEIGHT }}
            >
              {row.content}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
