import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { ChannelMark } from '@/components/brand/channel-marks';
import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { formatCurrency } from '@/lib/api/pay';
import { isElevatedClass } from '@/lib/consumer-classes';
import { formatCompactCount } from '@/lib/utils';

// ─── Me membership card (MESITA-932) — web ProfileSummaryCard parity.
// Centered photo + Class/IG badges, then five equal-height identity rows.

const CLASS_LETTER: Record<string, string> = {
  standard: 'S',
  premium: 'P',
  influencer: 'I',
  aura: 'A',
};

const ROW_HEIGHT = 44;

function classBadgeColors(classKey: string): readonly [string, string] {
  if (classKey === 'aura') return ['#fde68a', '#fb923c'] as const;
  if (classKey === 'influencer') return ['#fecaca', '#ef4444'] as const;
  if (classKey === 'premium') return ['#bfdbfe', '#2563eb'] as const;
  return ['#e5e7eb', '#9ca3af'] as const;
}

function classBadgeText(classKey: string): string {
  if (classKey === 'aura') return 'text-amber-950';
  if (classKey === 'influencer') return 'text-red-950';
  if (classKey === 'premium') return 'text-blue-950';
  return 'text-neutral-900';
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

  const rows: { key: string; text: string; tone?: 'muted' | 'secondary' }[] = [
    { key: 'identity', text: identityLine },
    { key: 'phone', text: phone || '—', tone: phone ? undefined : 'muted' },
    { key: 'class', text: classLabel },
    {
      key: 'instagram',
      text: igLine,
      tone: igConnected ? 'secondary' : 'muted',
    },
    { key: 'metrics', text: metricsLine },
  ];

  return (
    <View
      accessibilityLabel="Your Mesita membership card"
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
          className="font-display font-bold uppercase text-foreground/35"
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

          <LinearGradient
            colors={[...classBadgeColors(classKey)]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              position: 'absolute',
              left: -2,
              bottom: -2,
              width: 22,
              height: 22,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel={`Class: ${classLabel}`}
          >
            <Text
              className={`font-extrabold ${classBadgeText(classKey)}`}
              style={{ fontSize: 9 }}
            >
              {CLASS_LETTER[classKey] ?? 'S'}
            </Text>
          </LinearGradient>

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
              right: -2,
              bottom: -2,
              borderRadius: 999,
              padding: 1.5,
              borderWidth: 2,
              borderColor: '#fff',
            }}
            accessibilityLabel={
              igConnected
                ? 'Instagram connected'
                : 'Instagram not connected'
            }
          >
            <View className="h-[18px] w-[18px] items-center justify-center overflow-hidden rounded-full bg-card">
              {igConnected && avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <ChannelMark
                  channel="instagram"
                  size={10}
                  color={igConnected ? '#c02670' : '#775254'}
                />
              )}
            </View>
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
              <Text
                className={
                  row.key === 'identity'
                    ? 'font-display font-bold tracking-tight text-foreground'
                    : row.tone === 'secondary'
                      ? 'font-semibold text-secondary'
                      : row.tone === 'muted'
                        ? 'font-semibold text-muted-foreground'
                        : 'font-semibold text-foreground'
                }
                style={{
                  fontSize: row.key === 'identity' ? 15 : 13,
                  fontVariant: row.key === 'phone' || row.key === 'metrics'
                    ? ['tabular-nums']
                    : undefined,
                  letterSpacing: row.key === 'phone' ? 0.4 : undefined,
                }}
                numberOfLines={1}
              >
                {row.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
