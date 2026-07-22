import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, Crown, X } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';

import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
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
              <LinearGradient
                colors={['rgba(251,43,123,0.25)', 'rgba(255,110,180,0.25)', 'rgba(253,230,138,0.6)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ height: 80 }}
              />
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close"
                className="absolute top-3 right-3 size-8 items-center justify-center rounded-full bg-background/70"
              >
                <X color="#260409" size={16} />
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
                  {shown.plan === 'premium' ? (
                    <View className="absolute -bottom-0.5 -left-0.5 size-6 items-center justify-center rounded-full bg-amber-400">
                      <Crown color="#fff" size={14} fill="#fff" />
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

                {shown.plan === 'premium' ? (
                  <View className="mt-3 flex-row">
                    <LinearGradient
                      colors={[...GRADIENTS.premium]}
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
                      <Crown color="#fff" size={12} fill="#fff" />
                      <Text className="text-[11px] font-semibold text-white">
                        Premium
                      </Text>
                    </LinearGradient>
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
