import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { isElevatedClass } from '@/lib/consumer-classes';
import { formatCompactCount } from '@/lib/utils';

// ─── Membership Face Card (MESITA-904 · Variant B) — web ProfileSummaryCard
// parity. Issuer + Class chip header → photo + name face → Age/Sex pills →
// band (Instagram · Followers · Visits). Phone is off-card.

function PassportField({
  label,
  value,
  muted = false,
  divider = false,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  divider?: boolean;
}) {
  return (
    <View
      className={
        divider
          ? 'min-w-0 flex-1 items-center border-l border-border/60 px-2'
          : 'min-w-0 flex-1 items-center px-2'
      }
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
              ? 'mt-1 text-center font-medium text-muted-foreground/60'
              : 'mt-1 text-center font-semibold tracking-tight text-foreground'
          }
          style={{ fontSize: 14 }}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : (
        <View className="mt-1">{value}</View>
      )}
    </View>
  );
}

function IssuerLine() {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="h-px w-7 bg-foreground/15" />
      <Text
        className="font-display font-bold uppercase text-foreground/40"
        style={{ fontSize: 10, letterSpacing: 3 }}
      >
        Mesita
      </Text>
      <View className="h-px w-7 bg-foreground/15" />
    </View>
  );
}

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
        style={{ fontSize: 11, letterSpacing: 0.6 }}
      >
        {label}
      </Text>
    </LinearGradient>
  );
}

export function IdentityHeroSkeleton() {
  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-muted/50 px-4 pb-3.5 pt-4">
      <View className="flex-row items-center justify-between">
        <View className="h-2.5 w-24 rounded bg-muted" />
        <View className="h-6 w-14 rounded-full bg-muted" />
      </View>
      <View className="mt-3.5 flex-row items-center gap-3.5">
        <View className="h-[72px] w-[72px] shrink-0 rounded-full bg-muted" />
        <View className="min-w-0 flex-1 gap-2">
          <View className="h-5 w-40 rounded bg-muted" />
          <View className="flex-row gap-2">
            <View className="h-5 w-12 rounded-lg bg-muted" />
            <View className="h-5 w-10 rounded-lg bg-muted" />
          </View>
        </View>
      </View>
      <View className="mt-3.5 flex-row border-t border-border/60 pt-3.5">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 items-center gap-1.5 px-2">
            <View className="h-2.5 w-14 rounded bg-muted" />
            <View className="h-4 w-16 rounded bg-muted" />
          </View>
        ))}
      </View>
    </View>
  );
}

export function IdentityHero({
  classKey,
  name,
  sexLabel,
  age,
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
  avatarUrl?: string | null;
  igConnected: boolean;
  handle: string | null;
  followers: number;
  classLabel: string;
  /** Completed visits (revealed tickets) — null until the profile read lands. */
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
      ? (['rgba(245,204,88,0.20)', 'rgba(235,136,31,0.12)'] as const)
      : classKey === 'influencer'
        ? (['rgba(56,189,248,0.18)', 'rgba(2,132,199,0.12)'] as const)
        : (['rgba(139,108,232,0.18)', 'rgba(140,204,255,0.14)'] as const);

  return (
    <View
      accessibilityLabel="Your Mesita profile"
      className="overflow-hidden rounded-3xl border border-border px-4 pb-3.5 pt-4"
      style={SHADOW_ELEV}
    >
      <LinearGradient
        colors={
          isElevated
            ? elevatedWash
            : ['rgba(251,43,123,0.14)', 'rgba(255,90,171,0.09)']
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

      <View className="flex-row items-center justify-between gap-3">
        <IssuerLine />
        <ClassChip label={classLabel} classKey={classKey} />
      </View>

      <View className="mt-3.5 flex-row items-center gap-3.5">
        <LinearGradient
          colors={isElevated ? elevatedRing : [...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{ borderRadius: 999, padding: 2.5 }}
        >
          <View className="rounded-full bg-card p-[2.5px]">
            <View className="relative h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-full bg-muted">
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  accessibilityLabel={name}
                />
              ) : (
                <DefaultAvatar size={62} />
              )}
            </View>
          </View>
        </LinearGradient>

        <View className="min-w-0 flex-1">
          <Text
            className="font-display font-bold tracking-tight text-foreground"
            style={{ fontSize: 19 }}
            numberOfLines={1}
          >
            {name}
          </Text>
          {sexLabel || age != null ? (
            <View className="mt-2 flex-row flex-wrap gap-2">
              {sexLabel ? (
                <View className="rounded-lg border border-border/60 bg-white/55 px-2 py-0.5">
                  <Text
                    className="font-semibold text-muted-foreground"
                    style={{ fontSize: 11 }}
                  >
                    {sexLabel}
                  </Text>
                </View>
              ) : null}
              {age != null ? (
                <View className="rounded-lg border border-border/60 bg-white/55 px-2 py-0.5">
                  <Text
                    className="font-semibold text-muted-foreground"
                    style={{ fontSize: 11, fontVariant: ['tabular-nums'] }}
                  >
                    {age}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <View className="mt-3.5 flex-row border-t border-border/60 pt-3.5">
        <PassportField
          label="Instagram"
          muted={!igConnected}
          value={
            igConnected ? (
              <View className="min-w-0 flex-row items-center justify-center gap-1">
                <Text
                  className="shrink text-center font-semibold tracking-tight text-foreground"
                  style={{ fontSize: 14 }}
                  numberOfLines={1}
                >
                  {handle ? `@${handle}` : 'Connected'}
                </Text>
                <BadgeCheck color="rgba(38,4,9,0.5)" size={14} />
              </View>
            ) : (
              'Not connected'
            )
          }
        />
        <PassportField
          label="Followers"
          divider
          muted={!igConnected}
          value={
            igConnected ? (
              <Text
                className="text-center font-semibold tracking-tight text-foreground"
                style={{ fontSize: 14, fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
              >
                {formatCompactCount(followers)}
              </Text>
            ) : (
              '—'
            )
          }
        />
        <PassportField
          label="Visits"
          divider
          muted={visits == null}
          value={visits != null ? `${visits}` : '—'}
        />
      </View>
    </View>
  );
}
