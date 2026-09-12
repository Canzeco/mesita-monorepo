import { useRouter } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { PREMIUM_SUBSCRIBE_URL } from '@/lib/consumer-classes';
import { useAuth } from '@/providers/auth';

export default function PlanPage() {
  const router = useRouter();
  const { consumerClass } = useAuth();
  const origin = consumerClass?.origin;
  const isPremium = origin === 'subscription';

  return (
    <FullScreenSheet
      visible
      asRoute
      onClose={() => router.back()}
      title="Your plan"
      subtitle="A subscription, not a class. Cancel anytime."
    >
      <View className="rounded-2xl border border-border bg-card p-4">
        <Text className="font-display text-lg font-semibold text-foreground">
          {isPremium ? 'Premium' : 'Free'}
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          {isPremium
            ? "You're on Premium. Manage billing on the web."
            : 'Every account starts here. Premium is a web subscription — Apple review keeps checkout off this app.'}
        </Text>
      </View>
      {!isPremium ? (
        <Button
          onPress={() => void Linking.openURL(PREMIUM_SUBSCRIBE_URL)}
        >
          Subscribe on the web
        </Button>
      ) : null}
    </FullScreenSheet>
  );
}
