import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/ui/gradient-button';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { useAuth } from '@/providers/auth';

// Me — profile summary + class chip. The web Me page is modular boxes with
// per-box modals (PR #381); those modules port here incrementally. Premium
// subscription management stays on the web (no payment UI in the iOS app).
export default function MeScreen() {
  const { profile, consumerClass, session, signOut } = useAuth();
  const isPremium = consumerClass?.class === 'premium';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-5 pt-4">
        <Text className="font-display text-3xl text-foreground">Me</Text>

        <View className="mt-6 rounded-2xl border border-border bg-card p-5" style={SHADOW_ELEV}>
          <Text className="text-lg font-semibold text-foreground">
            {profile?.full_name ?? 'Mesita guest'}
          </Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {profile?.phone ?? session?.user.phone ?? ''}
          </Text>

          <View className="mt-4 flex-row">
            {isPremium ? (
              <LinearGradient
                colors={[...GRADIENTS.premium]}
                start={GRADIENT_DIAGONAL.start}
                end={GRADIENT_DIAGONAL.end}
                style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}
              >
                <Text className="text-xs font-semibold text-white">Premium</Text>
              </LinearGradient>
            ) : (
              <View className="rounded-full bg-muted px-3 py-1.5">
                <Text className="text-xs font-semibold text-muted-foreground">Free</Text>
              </View>
            )}
          </View>
        </View>

        <View className="mt-4">
          <GradientButton label="Sign out" onPress={() => void signOut()} />
        </View>
      </View>
    </SafeAreaView>
  );
}
