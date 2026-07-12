import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PayClient } from '@/components/rewards/PayClient';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { useAuth } from '@/providers/auth';

// Live Rewards page (web PayClient parity). Tab taps still open ComingSoonModal
// via ConsumerTabBar (web BottomNav soon=true); deep links land here.
export default function RewardsScreen() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <ShellWash>
        <SafeAreaView className="flex-1 items-center justify-center">
          <ActivityIndicator color="#fb2b7b" />
        </SafeAreaView>
      </ShellWash>
    );
  }

  if (!session?.user) {
    return (
      <ShellWash>
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="p-6">
            <Text
              className="font-semibold text-foreground"
              style={{ fontSize: 16 }}
            >
              Sign in to see your Rewards
            </Text>
          </View>
        </SafeAreaView>
      </ShellWash>
    );
  }

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.full_name ||
    '';

  return (
    <ShellWash>
      <SafeAreaView className="flex-1" edges={['top']}>
        <PayClient
          userId={session.user.id}
          code={profile?.code ?? ''}
          name={name}
          instagramHandle={
            profile?.instagram_handle ?? profile?.instagram ?? null
          }
        />
      </SafeAreaView>
    </ShellWash>
  );
}
