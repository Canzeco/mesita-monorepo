import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, BadgeCheck, Crown } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { isElevatedClass } from '@/lib/consumer-classes';
import { firstInitials } from '@/lib/utils';

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
      <View className="mt-4 gap-2.5 border-t border-border/60 pt-3.5">
        <View className="flex-row items-center gap-2.5">
          <View className="h-7 w-7 rounded-lg bg-muted" />
          <View className="h-4 w-40 rounded bg-muted" />
        </View>
        <View className="flex-row items-center gap-2.5">
          <View className="h-7 w-7 rounded-lg bg-muted" />
          <View className="h-4 w-40 rounded bg-muted" />
        </View>
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
}) {
  const isElevated = isElevatedClass(classKey);
  // Magnetic (top tier) reads gold; Premium reads its violet gradient.
  // Keep the readonly tuple shape — LinearGradient's `colors` needs
  // `readonly [ColorValue, ColorValue, ...]`, and spreading here would widen
  // it to a plain array (no contextual type on a variable declaration).
  const elevatedRing =
    classKey === 'magnetic' ? GRADIENTS.gold : GRADIENTS.premium;
  const elevatedWash =
    classKey === 'magnetic'
      ? (['rgba(245,204,88,0.20)', 'rgba(235,136,31,0.12)'] as const)
      : (['rgba(139,108,232,0.18)', 'rgba(140,204,255,0.14)'] as const);
  return (
    // Identity hero — web ProfileSummaryCard DNA (no "Me" H1, no Chip).
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
                <Text
                  className="font-display font-bold tracking-tight text-foreground/70"
                  style={{ fontSize: 24 }}
                >
                  {firstInitials(name)}
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>
        <View className="min-w-0 flex-1">
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

      <View className="mt-4 gap-2.5 border-t border-border/60 pt-3.5">
        <View className="flex-row items-center gap-2.5">
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
            }}
          >
            {/* lucide-react-native has no Instagram glyph — AtSign + IG gradient. */}
            <AtSign color="#ffffff" size={15} />
          </LinearGradient>
          {igConnected ? (
            <>
              <Text
                className="font-semibold tracking-tight text-foreground"
                style={{ fontSize: 13 }}
                numberOfLines={1}
              >
                {handle ? `@${handle}` : 'Connected'}
              </Text>
              {followers > 0 ? (
                <Text
                  className="shrink-0 text-muted-foreground"
                  style={{ fontSize: 12 }}
                >
                  {followers.toLocaleString('en-US')} followers
                </Text>
              ) : null}
              <BadgeCheck
                color="rgba(38,4,9,0.6)"
                size={18}
                style={{ marginLeft: 'auto' }}
              />
            </>
          ) : (
            <Text
              className="text-muted-foreground/80"
              style={{ fontSize: 13 }}
            >
              Not connected
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2.5">
          {isElevated ? (
            <LinearGradient
              colors={elevatedRing}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
              }}
            >
              <Crown color="#ffffff" size={15} />
            </LinearGradient>
          ) : (
            <View className="h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20">
              <Crown color="#b45309" size={15} />
            </View>
          )}
          <Text
            className="font-semibold tracking-tight text-foreground"
            style={{ fontSize: 13 }}
          >
            Mesita {classLabel}
          </Text>
          {classVia ? (
            <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
              via {classVia}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
