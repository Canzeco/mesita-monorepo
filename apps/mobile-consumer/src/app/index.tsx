import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { COLORS } from '@/constants/brand';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { useAuth } from '@/providers/auth';

// Entry gate — the RN equivalent of the web middleware + (shell) layout:
// no session → sign-in; session but not onboarded → onboard; else tabs.
export default function Index() {
  const { loading, session, onboarded } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }
  if (!onboarded) {
    return <Redirect href={CONSUMER_ROUTES.onboard} />;
  }
  return <Redirect href={CONSUMER_ROUTES.homeDefault} />;
}
