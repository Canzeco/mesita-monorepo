import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';

import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import type { SocialPerson } from '@/lib/social-feed-data';

type Props = {
  profile: SocialPerson | null;
  onClose: () => void;
};

export function SocialProfileSheet({ profile, onClose }: Props) {
  return (
    <Modal
      visible={profile != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end bg-black/40"
        onPress={onClose}
      >
        <Pressable
          className="rounded-t-3xl border border-border bg-card px-5 pt-4 pb-10"
          onPress={(e) => e.stopPropagation()}
        >
          {profile ? (
            <>
              <View className="mb-4 h-1 w-10 self-center rounded-full bg-border" />
              <View className="flex-row items-center gap-3">
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={{ width: 64, height: 64, borderRadius: 32 }}
                  contentFit="cover"
                />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="font-display text-xl font-semibold text-foreground">
                      {profile.name}
                    </Text>
                    {profile.plan === 'premium' ? (
                      <Crown color="#f59e0b" size={16} fill="#f59e0b" />
                    ) : null}
                  </View>
                  <View className="mt-1 flex-row items-center gap-1">
                    <Text className="text-sm text-muted-foreground">
                      {profile.igHandle}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="mt-5 flex-row justify-between">
                {(
                  [
                    ['Visits', profile.stats.visits],
                    ['Likes', profile.stats.likes],
                    ['Stories', profile.stats.stories],
                    ['Rewards', profile.stats.rewards],
                  ] as const
                ).map(([label, value]) => (
                  <View key={label} className="items-center">
                    <Text className="text-lg font-bold text-foreground">
                      {value}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground">
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={onClose}
                className="mt-6 overflow-hidden rounded-xl"
              >
                <LinearGradient
                  colors={[...GRADIENTS.pink]}
                  start={GRADIENT_DIAGONAL.start}
                  end={GRADIENT_DIAGONAL.end}
                  style={{ paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text className="text-sm font-semibold text-white">
                    Close
                  </Text>
                </LinearGradient>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
