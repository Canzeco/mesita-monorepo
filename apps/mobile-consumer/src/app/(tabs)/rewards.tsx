import { ActivityIndicator, View } from 'react-native';
import { Text } from 'react-native-paper';
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
        <SafeAreaView
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color="#fb2b7b" />
        </SafeAreaView>
      </ShellWash>
    );
  }

  if (!session?.user) {
    return (
      <ShellWash>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ padding: 24 }}>
            <Text variant="titleMedium">Sign in to see your Rewards</Text>
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
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
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
