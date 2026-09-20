import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, CreditCard, Megaphone, X } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';

import { COLORS, GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import { CLASS_METAL_INK_GRADIENT } from '@/lib/consumer-classes';
import type { SocialPerson } from '@/lib/social-feed-data';

// Profile dialog for the Social feed — port of web SocialProfileModal.
// Retains the last person through close so the exit animation keeps content.
//
// TODO(EF): social feed — profile stats are mock (see social-feed-data.ts).

export function SocialProfileSheet({
  profile,
  onClose,
}: {
  profile: SocialPerson | null;
  onClose: () => void;
}) {
  const [retained, setRetained] = useState<SocialPerson | null>(profile);
  if (profile && profile !== retained) setRetained(profile);
  const shown = profile ?? retained;

  const stats: { label: string; value: number }[] = shown
    ? [
        { label: 'Visits', value: shown.stats.visits },
        { label: 'Likes', value: shown.stats.likes },
        { label: 'Stories', value: shown.stats.stories },
        { label: 'Rewards', value: shown.stats.rewards },
      ]
    : [];

  const openIg = () => {
    if (!shown) return;
    const handle = shown.igHandle.replace(/^@/, '');
    void Linking.openURL(`https://instagram.com/${handle}`);
  };

  return (
    <Modal
      visible={profile != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={onClose}
        accessibilityLabel="Dismiss profile"
      >
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card"
          onPress={(e) => e.stopPropagation()}
          accessibilityLabel={shown ? `${shown.name} — profile` : 'Profile'}
        >
          {shown ? (
            <>
              {/* Atmosphere only — two brand pinks and a stray amber that
                  matched no token. The ink ramp at the SAME alphas; the amber
                  keeps its lightness (L*~91) and loses its chroma, so the band
                  still fades diagonally instead of flattening to the card. */}
              <LinearGradient
                colors={['rgba(23,23,23,0.25)', 'rgba(64,64,64,0.25)', 'rgba(229,229,229,0.6)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ height: 80 }}
              />
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close"
                className="absolute top-3 right-3 size-8 items-center justify-center rounded-full bg-background/70"
              >
                <X color={COLORS.foreground} size={16} />
              </Pressable>

              <View className="-mt-10 px-5 pb-5">
                <View className="relative self-start">
                  <Image
                    source={{ uri: shown.avatarUrl }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      borderWidth: 4,
                      borderColor: '#fff',
                    }}
                    contentFit="cover"
                  />
                  {/* RESERVED: two NAMED tiers, and both badges land in the
                      SAME absolute slot, so the fill is the only thing telling
                      them apart before the glyph is read. Values come from
                      CLASS_METAL_INK_GRADIENT (deep stop), pinned to
                      social-activity-row.tsx — NOT GRADIENTS.influencer /
                      .premium directly, which are Diamond's ink and the
                      Plan's ink respectively and showed the wrong metal for
                      both badges until this pointed at the canonical map. */}
                  {shown.plan === 'influencer' ? (
                    <View
                      className="absolute -bottom-0.5 -left-0.5 size-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: CLASS_METAL_INK_GRADIENT.influencer[1] }}
                    >
                      <Megaphone color="#fff" size={14} />
                    </View>
                  ) : null}
                  {shown.plan === 'premium' ? (
                    <View
                      className="absolute -bottom-0.5 -left-0.5 size-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: CLASS_METAL_INK_GRADIENT.premium[1] }}
                    >
                      <CreditCard color="#fff" size={14} />
                    </View>
                  ) : null}
                  <LinearGradient
                    colors={[...GRADIENTS.instagram]}
                    start={GRADIENT_DIAGONAL.start}
                    end={GRADIENT_DIAGONAL.end}
                    style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: '#fff',
                    }}
                  >
                    <AtSign color="#fff" size={14} />
                  </LinearGradient>
                </View>

                <Text className="mt-3 font-display text-lg font-semibold tracking-tight text-foreground">
                  {shown.name}
                </Text>
                <Pressable onPress={openIg} accessibilityRole="link">
                  <Text className="text-xs font-semibold text-foreground underline">
                    {shown.igHandle}
                  </Text>
                </Pressable>

                {shown.plan !== 'standard' ? (
                  <View className="mt-3 flex-row">
                    {shown.plan === 'influencer' ? (
                      <View
                        className="flex-row items-center rounded-full"
                        style={{
                          height: 28,
                          paddingHorizontal: 10,
                          gap: 4,
                          backgroundColor: CLASS_METAL_INK_GRADIENT.influencer[1],
                        }}
                      >
                        <Megaphone color="#fff" size={12} />
                        <Text className="text-[11px] font-semibold text-white">
                          Influencer
                        </Text>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={[...CLASS_METAL_INK_GRADIENT.premium]}
                        start={GRADIENT_DIAGONAL.start}
                        end={GRADIENT_DIAGONAL.end}
                        style={{
                          height: 28,
                          borderRadius: 14,
                          paddingHorizontal: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <CreditCard color="#fff" size={12} />
                        <Text className="text-[11px] font-semibold text-white">
                          Premium
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                ) : null}

                <View className="mt-4 flex-row gap-2">
                  {stats.map((s) => (
                    <View
                      key={s.label}
                      className="flex-1 items-center rounded-xl border border-border bg-muted/40 py-2"
                    >
                      <Text className="text-base font-bold text-foreground">
                        {s.value}
                      </Text>
                      <Text className="text-[10px] tracking-wider text-muted-foreground uppercase">
                        {s.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
