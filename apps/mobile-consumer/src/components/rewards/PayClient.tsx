import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { MyQrCard } from '@/components/rewards/MyQrCard';
import { PayTickets } from '@/components/rewards/PayTickets';
import { RewardsTopCards } from '@/components/rewards/RewardsTopCards';
import {
  computeRewardStats,
  useConsumerPayTickets,
} from '@/lib/hooks/useConsumerPayTickets';

export function PayClient({
  userId,
  code,
  name,
  instagramHandle,
}: {
  userId: string;
  code: string;
  name?: string;
  instagramHandle?: string | null;
}) {
  const tickets = useConsumerPayTickets(userId);
  const stats = useMemo(
    () => computeRewardStats(tickets.bundles, tickets.ticketMetaById),
    [tickets.bundles, tickets.ticketMetaById],
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 28,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      <RewardsTopCards />
      <MyQrCard
        code={code}
        name={name}
        instagramHandle={instagramHandle}
        stats={stats}
      />
      <View style={{ minHeight: 200 }}>
        <PayTickets {...tickets} />
      </View>
    </ScrollView>
  );
}
