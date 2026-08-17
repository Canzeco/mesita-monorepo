import { useRouter } from 'expo-router';
import { QrCode, TicketX } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { TicketRow } from '@/components/rewards/TicketRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { useConsumerTickets } from '@/lib/hooks/useConsumerTickets';
import { rewardsTicketPath } from '@/lib/consumer-route-contract';

// Inbox › Visits — mirror of web app/(shell)/inbox/visits.
//
// The TRACKING view of a visit. Rewards stays where you START one and where
// you pay; Inbox is where you watch the ones already in flight. Same data
// either way — this reads the very same useConsumerTickets hook the Rewards
// wallet does, so a ticket that changes status reads identically in both and
// there is no second source of truth to drift.
//
// Live before closed: a visit in progress is the only thing on this surface
// with a QR someone is waiting to scan.
export function InboxVisitsSection({ userId }: { userId: string }) {
  const router = useRouter();
  const tickets = useConsumerTickets(userId);

  const sections = useMemo(
    () => [
      { key: 'live', label: 'In progress', rows: tickets.active },
      { key: 'closed', label: 'Closed', rows: tickets.history },
    ],
    [tickets.active, tickets.history],
  );

  if (tickets.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#fb2b7b" />
      </View>
    );
  }

  if (tickets.status === 'error') {
    return (
      <EmptyState
        icon={TicketX}
        title="Couldn't load your visits"
        description="Your tickets didn't come back just now. Try again in a moment."
        action={{ label: 'Try again', onPress: () => tickets.retry() }}
      />
    );
  }

  if (tickets.active.length === 0 && tickets.history.length === 0) {
    return (
      <EmptyState
        icon={QrCode}
        title="No visits yet"
        description="Start a visit from Rewards and it shows up here — with its QR and whatever you saved."
      />
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pt-3 pb-10">
      {sections.map(({ key, label, rows }) =>
        rows.length === 0 ? null : (
          <View key={key} className="mb-5">
            <View className="mb-2 flex-row items-center gap-3 px-1">
              <Text className="text-[11px] font-semibold uppercase tracking-[1.6px] text-muted-foreground">
                {label}
              </Text>
              <View className="h-px flex-1 bg-border" />
              <Text className="text-[11px] font-semibold text-muted-foreground">
                {rows.length}
              </Text>
            </View>
            <View className="gap-2.5">
              {rows.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onOpen={() => router.push(rewardsTicketPath(ticket.id))}
                />
              ))}
            </View>
          </View>
        ),
      )}
    </ScrollView>
  );
}
