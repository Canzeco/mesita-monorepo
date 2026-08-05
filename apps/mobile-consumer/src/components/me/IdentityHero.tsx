import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { isElevatedClass } from '@/lib/consumer-classes';

// ─── Mesita passport v2 (MESITA-901) — web ProfileSummaryCard parity ────────
// A presentation card: everything sits on the center axis like a physical
// membership card. Issuer line (hairline · MESITA · hairline) on top, then a
// centered ring avatar over a centered name / phone / meta stack, then a
// full-width stat band of three EXACTLY equal, center-aligned columns
// (Instagram · Class · Visits) split by hairline separators.

// One stat column: centered small-caps label over a centered value, with an
// optional muted sub-line (followers).
function PassportField({
  label,
  value,
  sub,
  muted = false,
  divider = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string | null;
  /** Dim the value for absent data ("Not connected"). */
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
      {sub ? (
        <Text
          className="mt-0.5 text-center text-muted-foreground"
          style={{ fontSize: 11 }}
          numberOfLines={1}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

// Issuer line: MESITA wordmark on the center axis, flanked by hairlines —
// the engraved header of the card.
function IssuerLine() {
  return (
    <View className="flex-row items-center justify-center gap-3">
      <View className="h-px w-9 bg-foreground/15" />
      <Text
        className="font-display font-bold uppercase text-foreground/40"
        style={{ fontSize: 10, letterSpacing: 3 }}
      >
        Mesita
      </Text>
      <View className="h-px w-9 bg-foreground/15" />
    </View>
  );
}

export function IdentityHeroSkeleton() {
  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-muted/50 px-4 pb-4 pt-4">
      {/* Issuer-line stub, centered. */}
      <View className="h-2.5 w-24 self-center rounded bg-muted" />
      {/* Avatar: 76px to match the real ring avatar (66px + 2x2.5px rings). */}
      <View className="mt-4 h-[76px] w-[76px] self-center rounded-full bg-muted" />
      <View className="mt-3 items-center gap-2">
        <View className="h-5 w-40 rounded bg-muted" />
        <View className="h-3.5 w-28 rounded bg-muted" />
        <View className="h-3.5 w-20 rounded bg-muted" />
      </View>
      {/* Stat-band placeholder: three equal centered label/value stubs. */}
      <View className="mt-4 flex-row border-t border-border/60 pt-3.5">
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
  phone,
  meta,
  avatarUrl,
  igConnected,
  handle,
  followers,
  classLabel,
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
      className="overflow-hidden rounded-3xl border border-border px-4 pb-4 pt-4"
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

      <IssuerLine />

      {/* Story-ring avatar on the center axis: gradient → card → avatar. */}
      <View className="mt-4 items-center">
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
      </View>

      {/* Centered identity stack: name over phone over sex · age. */}
      <View className="mt-3 items-center">
        <Text
          className="text-center font-display font-bold tracking-tight text-foreground"
          style={{ fontSize: 20 }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          className={
            phone
              ? 'mt-1 text-center font-medium text-muted-foreground'
              : 'mt-1 text-center text-muted-foreground/70'
          }
          style={{ fontSize: 14 }}
          numberOfLines={1}
        >
          {phone || 'No phone added'}
        </Text>
        {meta ? (
          <Text
            className="mt-0.5 text-center text-muted-foreground/70"
            style={{ fontSize: 13 }}
            numberOfLines={1}
          >
            {meta}
          </Text>
        ) : null}
      </View>

      {/* Stat band: Instagram · Class · Visits — three equal centered columns
          split by hairlines, one deliberate band. The connect CTA lives on
          the Instagram box below — the card states, it never nags. */}
      <View className="mt-4 flex-row border-t border-border/60 pt-3.5">
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
          sub={
            igConnected && followers > 0
              ? `${followers.toLocaleString('en-US')} followers`
              : null
          }
        />
        {/* Class shows only its name — how it was earned stays off the card
            ("don't mention the class like that", MESITA-902). */}
        <PassportField label="Class" divider value={classLabel} />
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
