import { useRouter } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { RewardsTicketCard } from '@/components/rewards/RewardsTicketCard';
import { Button } from '@/components/ui/Button';
import { rewardsTicketPath } from '@/lib/consumer-route-contract';
import {
  bundleToCardView,
  type PayTicketsState,
} from '@/lib/hooks/useConsumerPayTickets';

function TicketCardSkeleton() {
  return (
    <View
      style={{
        height: 120,
        borderRadius: 16,
        backgroundColor: 'rgba(235,217,219,0.35)',
      }}
    />
  );
}

export function PayTickets({
  bundles,
  ticketMetaById,
  status,
  retry,
}: PayTicketsState) {
  const router = useRouter();

  return (
    <View style={{ gap: 12, flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingHorizontal: 2,
        }}
      >
        <Text style={{ fontWeight: '600', fontSize: 15 }}>Tickets</Text>
        <Text style={{ color: '#775254', fontSize: 12 }}>Most recent first</Text>
      </View>

      {status === 'loading' ? (
        <>
          <TicketCardSkeleton />
          <TicketCardSkeleton />
        </>
      ) : status === 'error' ? (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(220,38,38,0.3)',
            backgroundColor: 'rgba(220,38,38,0.05)',
            paddingHorizontal: 16,
            paddingVertical: 24,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: '#dc2626',
              fontWeight: '600',
              textAlign: 'center',
              fontSize: 15,
            }}
          >
            Couldn’t load your tickets.
          </Text>
          <Text
            style={{
              marginTop: 4,
              color: '#775254',
              textAlign: 'center',
              lineHeight: 18,
              fontSize: 13,
            }}
          >
            Check your connection and try again.
          </Text>
          <View style={{ marginTop: 16, alignSelf: 'stretch' }}>
            <Button variant="outline" onPress={retry} accessibilityLabel="Retry">
              Retry
            </Button>
          </View>
        </View>
      ) : bundles.length === 0 ? (
        <View
          style={{
            minHeight: 240,
            borderRadius: 16,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#ebd9db',
            paddingHorizontal: 24,
            paddingVertical: 40,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: 'rgba(251,43,123,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ticket color="#fb2b7b" size={28} />
          </View>
          <Text style={{ fontWeight: '600', fontSize: 17 }}>No tickets yet</Text>
          <Text
            style={{
              color: '#775254',
              textAlign: 'center',
              maxWidth: 300,
              lineHeight: 18,
              fontSize: 13,
            }}
          >
            When staff opens your ticket at the table, it appears here with the
            place, your visit time, and the steps to finish. Completed tickets
            stay here as history.
          </Text>
        </View>
      ) : (
        bundles.map((b) => (
          <RewardsTicketCard
            key={b.ticketId}
            view={bundleToCardView(b, ticketMetaById.get(b.ticketId))}
            onOpen={() => router.push(rewardsTicketPath(b.ticketId))}
          />
        ))
      )}
    </View>
  );
}
