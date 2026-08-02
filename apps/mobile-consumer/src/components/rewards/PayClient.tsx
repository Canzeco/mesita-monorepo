import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { MyQrCard } from '@/components/rewards/MyQrCard';
import { PayTickets } from '@/components/rewards/PayTickets';
import { RewardProgramCard } from '@/components/rewards/RewardProgramCard';
import { RewardsTopCards } from '@/components/rewards/RewardsTopCards';
import {
  computeRewardStats,
  derivePassTicket,
  useConsumerPayTickets,
} from '@/lib/hooks/useConsumerPayTickets';
import { TAB_SCROLL_PADDING_BOTTOM } from '@/lib/tab-layout';

// Rewards scroll: top cards → coral passport → tickets (web PayClient).
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
  // A visit in flight flips the pass from "what you can claim anywhere" to the
  // resolved rate at this table — same fetch, no extra request.
  const activeTicket = useMemo(
    () => derivePassTicket(tickets.bundles, tickets.ticketMetaById),
    [tickets.bundles, tickets.ticketMetaById],
  );

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: TAB_SCROLL_PADDING_BOTTOM,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      <RewardProgramCard />
      <RewardsTopCards />
      <MyQrCard
        code={code}
        name={name}
        instagramHandle={instagramHandle}
        stats={stats}
        activeTicket={activeTicket}
      />
      <View className="min-h-[200px]">
        <PayTickets {...tickets} />
      </View>
    </ScrollView>
  );
}
