import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PayClient } from '@/components/rewards/PayClient';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { useAuth } from '@/providers/auth';

// Live Rewards page (web PayClient parity) — the tab unparked in #548.
// No `profile` read: the wallet needs the user id and nothing else since the
// identity header and the member code both left (MESITA-820).
export default function RewardsScreen() {
  const { loading, session } = useAuth();

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

  return (
    <ShellWash>
      <SafeAreaView className="flex-1" edges={['top']}>
        <PayClient userId={session.user.id} />
      </SafeAreaView>
    </ShellWash>
  );
}
