import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { ChannelMark } from '@/components/brand/channel-marks';
import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { formatCurrency } from '@/lib/api/pay';
import { isElevatedClass } from '@/lib/consumer-classes';
import { formatCompactCount } from '@/lib/utils';

// ─── ID-1 membership card (MESITA-930) — web ProfileSummaryCard parity.
// Dual badges: Cls (left) + IG (right). Class once. Footer Saved · Visits · Stories.

<<<<<<< HEAD
const CLASS_LETTER: Record<string, string> = {
  standard: 'S',
  premium: 'P',
  influencer: 'I',
  aura: 'A',
};
=======
function ClassChip({
  label,
  classKey,
}: {
  label: string;
  classKey: string;
}) {
  const colors =
    classKey === 'aura'
      ? (['rgba(245,204,88,0.45)', 'rgba(235,136,31,0.28)'] as const)
      : classKey === 'influencer'
        ? (['rgba(252,165,165,0.55)', 'rgba(239,68,68,0.30)'] as const)
        : classKey === 'premium'
          ? (['rgba(147,197,253,0.55)', 'rgba(37,99,235,0.28)'] as const)
          : (['rgba(206,217,229,0.70)', 'rgba(155,166,177,0.40)'] as const);
  const textClass =
    classKey === 'aura'
      ? 'text-amber-900'
      : classKey === 'influencer'
        ? 'text-red-900'
        : classKey === 'premium'
          ? 'text-blue-900'
          : 'text-foreground';
>>>>>>> 11c8de23 (feat(consumer): class icons Smile/Megaphone/CreditCard/Crown + Pyramid mark)

function classBadgeColors(classKey: string): readonly [string, string] {
  if (classKey === 'aura') return ['#fde68a', '#fb923c'] as const;
  if (classKey === 'influencer') return ['#bae6fd', '#38bdf8'] as const;
  if (classKey === 'premium') return ['#ddd6fe', '#c084fc'] as const;
  return ['rgba(251,43,123,0.85)', 'rgba(255,90,171,0.85)'] as const;
}

function classBadgeText(classKey: string): string {
  if (classKey === 'standard') return 'text-white';
  if (classKey === 'aura') return 'text-amber-950';
  if (classKey === 'influencer') return 'text-sky-950';
  return 'text-violet-950';
}

export function IdentityHeroSkeleton() {
  return (
    <View
      className="w-full overflow-hidden rounded-2xl border border-border bg-muted/50 px-4 py-3"
      style={{ aspectRatio: 1.586 }}
    >
      <View className="flex-1 justify-between">
        <View className="h-2.5 w-16 rounded bg-muted" />
        <View className="flex-row items-center gap-3">
          <View className="h-14 w-14 shrink-0 rounded-full bg-muted" />
          <View className="min-w-0 flex-1 gap-2">
            <View className="h-5 w-36 rounded bg-muted" />
            <View className="h-3 w-24 rounded bg-muted" />
            <View className="h-3 w-28 rounded bg-muted" />
            <View className="h-3 w-32 rounded bg-muted" />
          </View>
        </View>
        <View className="flex-row gap-2 rounded-xl bg-muted/80 p-2">
          <View className="h-8 flex-1 rounded bg-muted" />
          <View className="h-8 flex-1 rounded bg-muted" />
          <View className="h-8 flex-1 rounded bg-muted" />
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
  stories,
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
  stories: number | null;
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

  const whisper = [sexLabel, age != null ? String(age) : null]
    .filter(Boolean)
    .join(' · ');
  const igLine = igConnected
    ? [handle ? `@${handle}` : 'Connected', formatCompactCount(followers)]
        .filter(Boolean)
        .join(' · ')
    : 'Instagram not connected';

  return (
    <View
      accessibilityLabel="Your Mesita membership card"
      className="w-full overflow-hidden rounded-2xl border border-border px-4 py-3"
      style={[SHADOW_ELEV, { aspectRatio: 1.586 }]}
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

      <View className="flex-1 justify-between">
        <Text
          className="font-display font-bold uppercase text-foreground/35"
          style={{ fontSize: 10, letterSpacing: 2.8 }}
        >
          Mesita
        </Text>

        <View className="flex-row items-center gap-3">
          <View
            className="relative shrink-0"
            style={{ width: 56, height: 56, overflow: 'visible' }}
          >
            <LinearGradient
              colors={isElevated ? elevatedRing : [...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{ borderRadius: 999, padding: 2 }}
            >
              <View className="rounded-full bg-card p-[2px]">
                <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      accessibilityLabel={name}
                    />
                  ) : (
                    <DefaultAvatar size={56} />
                  )}
                </View>
              </View>
            </LinearGradient>

            {/* Cls badge — class gem, left */}
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

            {/* IG badge — ring + face / glyph, right */}
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

          <View className="min-w-0 flex-1">
            <Text
              className="font-display font-bold tracking-tight text-foreground"
              style={{ fontSize: 17 }}
              numberOfLines={1}
            >
              {name}
            </Text>
            {whisper ? (
              <Text
                className="mt-0.5 font-medium text-muted-foreground"
                style={{ fontSize: 11 }}
                numberOfLines={1}
              >
                {whisper}
              </Text>
            ) : null}
            {phone ? (
              <Text
                className="mt-0.5 font-semibold text-foreground/70"
                style={{
                  fontSize: 11,
                  fontVariant: ['tabular-nums'],
                  letterSpacing: 0.4,
                }}
                numberOfLines={1}
              >
                {phone}
              </Text>
            ) : null}
            <Text
              className={
                igConnected
                  ? 'mt-0.5 font-semibold text-secondary'
                  : 'mt-0.5 font-semibold text-muted-foreground/70'
              }
              style={{ fontSize: 11 }}
              numberOfLines={1}
            >
              {igLine}
            </Text>
          </View>
        </View>

        <View
          accessibilityLabel="Your Mesita metrics"
          className="flex-row gap-1 rounded-xl border border-border/80 bg-white/55 px-2 py-1.5"
        >
          <MetricCell
            value={
              savedCents == null ? '—' : formatCurrency(savedCents)
            }
            label="Saved"
          />
          <MetricCell
            value={visits == null ? '—' : String(visits)}
            label="Visits"
          />
          <MetricCell
            value={stories == null ? '—' : String(stories)}
            label="Stories"
          />
        </View>
      </View>
    </View>
  );
}

function MetricCell({ value, label }: { value: string; label: string }) {
  return (
    <View className="min-w-0 flex-1 items-center">
      <Text
        className="font-display font-bold tracking-tight text-foreground"
        style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        className="mt-0.5 font-bold uppercase text-muted-foreground"
        style={{ fontSize: 8, letterSpacing: 0.6 }}
      >
        {label}
      </Text>
    </View>
  );
}
