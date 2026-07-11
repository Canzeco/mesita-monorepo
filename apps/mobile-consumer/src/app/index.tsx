import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/providers/auth';

// Entry gate — the RN equivalent of the web middleware + (shell) layout:
// no session → sign-in; session but not onboarded → onboard; else tabs.
export default function Index() {
  const { loading, session, onboarded } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#fb2b7b" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }
  if (!onboarded) {
    return <Redirect href="/onboard" />;
  }
  return <Redirect href="/(tabs)/home" />;
}
