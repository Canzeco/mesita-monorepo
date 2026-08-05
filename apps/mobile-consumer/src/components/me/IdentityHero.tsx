import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { isElevatedClass } from '@/lib/consumer-classes';

// ─── Mesita passport (MESITA-888) — web ProfileSummaryCard parity ──────────
// Identity zone (ring avatar + name + phone + meta, MESITA wordmark
// top-right) over a passport strip of three labeled fields — Instagram,
// Class, Visits. No icon tiles, no list rows: labels + values, like the
// data page of a passport.

// One passport field: small-caps label over a semibold value, with an
// optional muted sub-line (followers, class origin).
function PassportField({
  label,
  value,
  sub,
  muted = false,
  flex,
  divider = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string | null;
  /** Dim the value for absent data ("—"). */
  muted?: boolean;
  flex: number;
  divider?: boolean;
}) {
  return (
    <View
      className={divider ? 'min-w-0 border-l border-border/60 pl-3' : 'min-w-0'}
      style={{ flex }}
    >
      <Text
        className="font-semibold uppercase text-muted-foreground/70"
        style={{ fontSize: 10, letterSpacing: 1.4 }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text
          className={
            muted
              ? 'mt-1 font-medium text-muted-foreground/60'
              : 'mt-1 font-semibold tracking-tight text-foreground'
          }
          style={{ fontSize: 14 }}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : (
        <View className="mt-1">{value}</View>
      )}
      {sub ? (
        <Text
          className="mt-0.5 text-muted-foreground"
          style={{ fontSize: 11 }}
          numberOfLines={1}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function IdentityHeroSkeleton() {
  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-muted/50 p-4">
      <View className="flex-row items-center gap-4">
        <View className="h-[76px] w-[76px] rounded-full bg-muted" />
        <View className="min-w-0 flex-1 gap-2">
          <View className="h-5 w-40 rounded bg-muted" />
          <View className="h-3.5 w-28 rounded bg-muted" />
          <View className="h-3.5 w-20 rounded bg-muted" />
        </View>
      </View>
      {/* Passport-strip placeholder: three label/value stubs. */}
      <View className="mt-4 flex-row gap-3 border-t border-border/60 pt-3.5">
        {[1.35, 1, 0.75].map((flex, i) => (
          <View key={i} className="gap-1.5" style={{ flex }}>
            <View className="h-2.5 w-14 rounded bg-muted" />
            <View className="h-4 w-full max-w-24 rounded bg-muted" />
          </View>
        ))}
      </View>
    </View>
  );
}

export function IdentityHero({
  classKey,
  name,
  phone,
  meta,
  avatarUrl,
  igConnected,
  handle,
  followers,
  classLabel,
  classVia,
  visits,
}: {
  classKey: string;
  name: string;
  phone: string;
  meta: string;
  avatarUrl?: string | null;
  igConnected: boolean;
  handle: string | null;
  followers: number;
  classLabel: string;
  classVia: string | null;
  /** Completed visits (revealed tickets) — null until the profile read lands. */
  visits: number | null;
}) {
  const isElevated = isElevatedClass(classKey);
  // Aura (top of the ladder) reads gold; Influencer reads sky; Premium keeps
  // its violet gradient — the ring is the class's color signature.
  // Keep the readonly tuple shape — LinearGradient's `colors` needs
  // `readonly [ColorValue, ColorValue, ...]`, and spreading here would widen
  // it to a plain array (no contextual type on a variable declaration).
  const elevatedRing =
    classKey === 'aura'
      ? GRADIENTS.gold
      : classKey === 'influencer'
        ? GRADIENTS.sky
        : GRADIENTS.premium;
  const elevatedWash =
    classKey === 'aura'
      ? (['rgba(245,204,88,0.20)', 'rgba(235,136,31,0.12)'] as const)
      : classKey === 'influencer'
        ? (['rgba(56,189,248,0.18)', 'rgba(2,132,199,0.12)'] as const)
        : (['rgba(139,108,232,0.18)', 'rgba(140,204,255,0.14)'] as const);
  return (
    <View
      className="overflow-hidden rounded-3xl border border-border p-4"
      style={SHADOW_ELEV}
    >
      <LinearGradient
        colors={
          isElevated
            ? elevatedWash
            : ['rgba(251,43,123,0.10)', 'rgba(255,90,171,0.08)']
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

      {/* Document mark — quiet, top-right, like the issuer line on a card. */}
      <Text
        className="font-display font-bold uppercase text-foreground/30"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          fontSize: 10,
          letterSpacing: 3,
        }}
      >
        Mesita
      </Text>

      <View className="flex-row items-center gap-4">
        {/* Double story-ring: gradient → card → avatar (web parity). */}
        <LinearGradient
          colors={isElevated ? elevatedRing : [...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{ borderRadius: 999, padding: 2.5 }}
        >
          <View className="rounded-full bg-card p-[2.5px]">
            <View className="relative h-[66px] w-[66px] items-center justify-center overflow-hidden rounded-full bg-muted">
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  accessibilityLabel={name}
                />
              ) : (
                <DefaultAvatar size={66} />
              )}
            </View>
          </View>
        </LinearGradient>
        <View className="min-w-0 flex-1 pr-10">
          <Text
            className="font-display font-bold tracking-tight text-foreground"
            style={{ fontSize: 20 }}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            className={
              phone
                ? 'mt-1 font-medium text-muted-foreground'
                : 'mt-1 text-muted-foreground/70'
            }
            style={{ fontSize: 14 }}
            numberOfLines={1}
          >
            {phone || 'No phone added'}
          </Text>
          {meta ? (
            <Text
              className="mt-0.5 text-muted-foreground/70"
              style={{ fontSize: 13 }}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Passport strip: Instagram · Class · Visits. The connect CTA lives on
          the Instagram box below — the card states, it never nags. */}
      <View className="mt-4 flex-row border-t border-border/60 pt-3.5">
        <PassportField
          label="Instagram"
          flex={1.35}
          muted={!igConnected}
          value={
            igConnected ? (
              <View className="min-w-0 flex-row items-center gap-1 pr-3">
                <Text
                  className="shrink font-semibold tracking-tight text-foreground"
                  style={{ fontSize: 14 }}
                  numberOfLines={1}
                >
                  {handle ? `@${handle}` : 'Connected'}
                </Text>
                <BadgeCheck color="rgba(38,4,9,0.5)" size={14} />
              </View>
            ) : (
              '—'
            )
          }
          sub={
            igConnected && followers > 0
              ? `${followers.toLocaleString('en-US')} followers`
              : null
          }
        />
        <PassportField
          label="Class"
          flex={1}
          divider
          value={classLabel}
          sub={classVia ? `via ${classVia}` : null}
        />
        <PassportField
          label="Visits"
          flex={0.75}
          divider
          muted={visits == null}
          value={visits != null ? `${visits}` : '—'}
        />
      </View>
    </View>
  );
}
