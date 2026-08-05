import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { isElevatedClass } from '@/lib/consumer-classes';
import { formatCompactCount } from '@/lib/utils';

// ─── Simple ID-1 membership card (MESITA-918) — web ProfileSummaryCard parity.
// Face + name + class · whisper · phone · one footer line. No metric columns.

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
        ? (['rgba(125,211,252,0.45)', 'rgba(14,165,233,0.28)'] as const)
        : classKey === 'premium'
          ? (['rgba(196,181,253,0.45)', 'rgba(167,139,250,0.28)'] as const)
          : (['rgba(251,43,123,0.22)', 'rgba(255,90,171,0.18)'] as const);
  const textClass =
    classKey === 'aura'
      ? 'text-amber-900'
      : classKey === 'influencer'
        ? 'text-sky-900'
        : classKey === 'premium'
          ? 'text-violet-900'
          : 'text-primary';

  return (
    <LinearGradient
      colors={[...colors]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{ borderRadius: 999, borderWidth: 1, borderColor: 'rgba(38,4,9,0.08)' }}
    >
      <Text
        className={`px-2.5 py-1 font-bold uppercase ${textClass}`}
        style={{ fontSize: 10, letterSpacing: 0.6 }}
      >
        {label}
      </Text>
    </LinearGradient>
  );
}

export function IdentityHeroSkeleton() {
  return (
    <View
      className="w-full overflow-hidden rounded-2xl border border-border bg-muted/50 px-4 py-3"
      style={{ aspectRatio: 1.586 }}
    >
      <View className="flex-1 justify-between">
        <View className="flex-row items-center justify-between">
          <View className="h-2.5 w-16 rounded bg-muted" />
          <View className="h-5 w-14 rounded-full bg-muted" />
        </View>
        <View className="flex-row items-center gap-3">
          <View className="h-14 w-14 shrink-0 rounded-full bg-muted" />
          <View className="min-w-0 flex-1 gap-2">
            <View className="h-5 w-36 rounded bg-muted" />
            <View className="h-3 w-24 rounded bg-muted" />
            <View className="h-3 w-28 rounded bg-muted" />
          </View>
        </View>
        <View className="h-3 w-40 rounded bg-muted" />
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
  visits: number | null;
}) {
  const isElevated = isElevatedClass(classKey);
  const elevatedRing =
    classKey === 'aura'
      ? GRADIENTS.gold
      : classKey === 'influencer'
        ? GRADIENTS.sky
        : GRADIENTS.premium;
  const elevatedWash =
    classKey === 'aura'
      ? (['rgba(245,204,88,0.18)', 'rgba(235,136,31,0.10)'] as const)
      : classKey === 'influencer'
        ? (['rgba(56,189,248,0.16)', 'rgba(2,132,199,0.10)'] as const)
        : (['rgba(139,108,232,0.16)', 'rgba(140,204,255,0.12)'] as const);

  const whisper = [sexLabel, age != null ? String(age) : null]
    .filter(Boolean)
    .join(' · ');
  const footerLeft = igConnected
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
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="font-display font-bold uppercase text-foreground/35"
            style={{ fontSize: 10, letterSpacing: 2.8 }}
          >
            Mesita
          </Text>
          <ClassChip label={classLabel} classKey={classKey} />
        </View>

        <View className="flex-row items-center gap-3">
          <View className="relative shrink-0">
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
              }}
            >
              <View className="h-5 w-5 overflow-hidden rounded-full bg-card">
                {igConnected && avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="h-full w-full bg-muted" />
                )}
              </View>
            </LinearGradient>
          </View>

          <View className="min-w-0 flex-1">
            <Text
              className="font-display font-bold tracking-tight text-foreground"
              style={{ fontSize: 18 }}
              numberOfLines={1}
            >
              {name}
            </Text>
            {whisper ? (
              <Text
                className="mt-1 font-medium text-muted-foreground"
                style={{ fontSize: 12 }}
                numberOfLines={1}
              >
                {whisper}
              </Text>
            ) : null}
            {phone ? (
              <Text
                className="mt-1 font-semibold text-foreground/70"
                style={{
                  fontSize: 12,
                  fontVariant: ['tabular-nums'],
                  letterSpacing: 0.4,
                }}
                numberOfLines={1}
              >
                {phone}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-baseline justify-between gap-3">
          <Text
            className={
              igConnected
                ? 'min-w-0 shrink font-semibold text-secondary'
                : 'min-w-0 shrink font-semibold text-muted-foreground/70'
            }
            style={{ fontSize: 12 }}
            numberOfLines={1}
          >
            {footerLeft}
          </Text>
          <Text
            className="shrink-0 font-semibold text-muted-foreground"
            style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}
          >
            Visits {visits ?? '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}
