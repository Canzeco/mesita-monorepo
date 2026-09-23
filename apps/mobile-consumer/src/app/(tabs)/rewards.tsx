import { ActivityIndicator, Text, View } from 'react-native';

import { PayClient } from '@/components/rewards/PayClient';
import { TabFrame, VISIT_RAIL } from '@/components/ui/TabRail';
import { COLORS } from '@/constants/brand';
import { useAuth } from '@/providers/auth';

// Visit › Pay (MESITA-2050) — web's /new-visit, the place list that starts a
// visit. The route stays `(tabs)/rewards`; only the label and the frame moved.
// No `profile` read: the list needs the user id and nothing else (MESITA-820).
export default function RewardsScreen() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <TabFrame items={VISIT_RAIL} value="pay">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </TabFrame>
    );
  }

  if (!session?.user) {
    return (
      <TabFrame items={VISIT_RAIL} value="pay">
        <View className="p-6">
          <Text
            className="font-semibold text-foreground"
            style={{ fontSize: 16 }}
          >
            Sign in to pay
          </Text>
        </View>
      </TabFrame>
    );
  }

  return (
    <TabFrame items={VISIT_RAIL} value="pay">
      <PayClient userId={session.user.id} />
    </TabFrame>
  );
}
