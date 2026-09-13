import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, Copy } from 'lucide-react-native';
import { Pressable, Share, Text, View } from 'react-native';

import { ChannelMark } from '@/components/brand/channel-marks';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { COLORS, GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { COUNTRIES } from '@/lib/countries';
import { CLASSES, CLASS_ICONS } from '@/lib/consumer-classes';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { useEffectiveClass } from '@/lib/mock-class';
import { toast } from '@/lib/toast';
import {
  ageFromBirthday,
  formatCompactCount,
  formatSex,
} from '@/lib/utils';
import { useAuth } from '@/providers/auth';

// Passport is a document plus two doors (MESITA-1801). Identity (photo,
// name, age·sex·country, member number) is look, not a button. Class and
// Instagram are the only tiles — they open the existing pages. The ladder,
// invite PIN, and connect form stay there. No Profile row (Me › Profile
// is the editor). No Plan (MESITA-1619). No privacy (MESITA-1688).
//
// Colour means class: metal on the identity ring/wash and the Class 44px
// glyph. Instagram's brand gradient stays inside its glyph, never a
// full-width pink field. Copy is origin-aware — do not tell a Diamond
// guest to climb.

const CLASS_FLOOR = CLASSES[0];
const CLASS_CEILING = CLASSES[CLASSES.length - 1];
const REACH_CANDIDATES = CLASSES.filter((c) => c.followerThreshold > 0);
const REACH_ENTRY = REACH_CANDIDATES.reduce(
  (lowest, c) =>
    c.followerThreshold < lowest.followerThreshold ? c : lowest,
  REACH_CANDIDATES[0] ?? CLASSES[0],
);

function classReward(classId: string): string {
  if (classId === CLASS_CEILING.id) return 'Highest discount';
  if (classId === CLASS_FLOOR.id) return 'Base discount';
  return 'Higher discount';
}

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

function classWash(classKey: string): readonly [string, string] {
  if (classKey === 'aura') {
    return ['rgba(245,204,88,0.18)', 'rgba(235,136,31,0.10)'] as const;
  }
  if (classKey === 'influencer') {
    return ['rgba(239,68,68,0.16)', 'rgba(185,28,28,0.10)'] as const;
  }
  if (classKey === 'premium') {
    return ['rgba(37,99,235,0.16)', 'rgba(96,165,250,0.12)'] as const;
  }
  return ['rgba(156,163,175,0.16)', 'rgba(156,163,175,0.06)'] as const;
}

function phoneCountry(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) {
    return COUNTRIES.find((c) => c.code === 'MX') ?? null;
  }
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  return sorted.find((c) => digits.startsWith(c.dial)) ?? null;
}

export default function PassportPage() {
  const router = useRouter();
  const { profile, consumerClass } = useAuth();
  const effective = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const classLabel =
    CLASSES.find((c) => c.id === effective.key)?.label ?? CLASS_FLOOR.label;
  const ClassIcon = CLASS_ICONS[effective.key];
  const handle = effective.handle ?? profile?.instagram_handle ?? null;
  const igConnected = effective.origin === 'instagram' || Boolean(handle);
  const code = profile?.code ?? null;
  const atCeiling = effective.key === CLASS_CEILING.id;
  const onFloor = effective.key === CLASS_FLOOR.id;

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.full_name ||
    'Mesita member';
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const country = phoneCountry(profile?.phone);
  const detailLine = [
    age != null ? `${age}` : null,
    sexLabel,
    country ? `${country.flag} ${country.name}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const classNote =
    onFloor && !igConnected
      ? 'Climb with Instagram or an invite'
      : igConnected
        ? classReward(effective.key)
        : `${classReward(effective.key)} · Instagram or an invite`;

  const igHeadline = igConnected
    ? handle
      ? `@${handle}`
      : 'Connected'
    : atCeiling
      ? 'Not connected'
      : 'Connect it';
  const igNote = igConnected
    ? `${formatCompactCount(effective.followers)} followers`
    : atCeiling
      ? 'Connect for Stories and Rewards'
      : `${REACH_ENTRY.followerThreshold.toLocaleString('en-US')}+ followers lifts you to ${REACH_ENTRY.label}`;

  async function copyCode() {
    if (!code) return;
    try {
      await Share.share({ message: code });
    } catch {
      toast("Couldn't share the number");
    }
  }

  return (
    <FullScreenSheet
      visible
      asRoute
      onClose={() => router.back()}
      title="Your passport"
    >
      <View className="gap-3.5">
        <View className="overflow-hidden rounded-2xl border border-border bg-card">
          <LinearGradient
            colors={[...classWash(effective.key)]}
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
          <View className="flex-row items-center gap-4 p-4">
            <LinearGradient
              colors={[...classBadgeColors(effective.key)]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{ borderRadius: 999, padding: 2.5 }}
            >
              <View className="rounded-full bg-card p-[2px]">
                <View className="h-[56px] w-[56px] items-center justify-center overflow-hidden rounded-full bg-muted">
                  {profile?.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
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
            <View className="min-w-0 flex-1">
              <Text
                className="font-display text-lg font-semibold text-foreground"
                numberOfLines={1}
              >
                {name}
              </Text>
              {detailLine ? (
                <Text
                  className="text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  {detailLine}
                </Text>
              ) : null}
              <View className="mt-2 flex-row items-center">
                <Text className="font-display text-base tabular-nums tracking-wide text-foreground">
                  {code ?? '—'}
                </Text>
                {code ? (
                  <Pressable
                    onPress={() => void copyCode()}
                    accessibilityLabel="Copy member number"
                    className="h-11 w-11 items-center justify-center rounded-xl"
                  >
                    <Copy color={COLORS.mutedForeground} size={16} />
                  </Pressable>
                ) : null}
              </View>
              {!code ? (
                <Text className="text-xs text-muted-foreground">
                  Assigned on your next profile load.
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => router.push(CONSUMER_ROUTES.mePages.class)}
          accessibilityRole="link"
          accessibilityLabel={`Class: ${classLabel}`}
          className="min-h-[72px] flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3.5 active:scale-[0.99]"
        >
          <LinearGradient
            colors={[...classBadgeColors(effective.key)]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ClassIcon color={classBadgeIconColor(effective.key)} size={20} />
          </LinearGradient>
          <View className="min-w-0 flex-1">
            <Text
              className="font-bold uppercase text-muted-foreground"
              style={{ fontSize: 10, letterSpacing: 1.2 }}
            >
              Class
            </Text>
            <View className="mt-0.5 self-start rounded-full px-2.5 py-0.5" style={{ backgroundColor: classBadgeColors(effective.key)[0] }}>
              <Text
                className="text-sm font-bold"
                style={{ color: classBadgeIconColor(effective.key) }}
              >
                {classLabel}
              </Text>
            </View>
            <Text className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {classNote}
            </Text>
          </View>
          <ChevronRight color={COLORS.mutedForeground} size={16} />
        </Pressable>

        <Pressable
          onPress={() => router.push(CONSUMER_ROUTES.mePages.instagram)}
          accessibilityRole="link"
          accessibilityLabel={`Instagram: ${igHeadline}`}
          className="min-h-[72px] flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3.5 active:scale-[0.99]"
        >
          <LinearGradient
            colors={[...GRADIENTS.instagram]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChannelMark channel="instagram" size={20} color="#ffffff" />
          </LinearGradient>
          <View className="min-w-0 flex-1">
            <Text
              className="font-bold uppercase text-muted-foreground"
              style={{ fontSize: 10, letterSpacing: 1.2 }}
            >
              Instagram
            </Text>
            <Text
              className="mt-0.5 text-sm font-bold text-foreground"
              numberOfLines={1}
            >
              {igHeadline}
            </Text>
            <Text className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {igNote}
            </Text>
          </View>
          <ChevronRight color={COLORS.mutedForeground} size={16} />
        </Pressable>
      </View>
    </FullScreenSheet>
  );
}
