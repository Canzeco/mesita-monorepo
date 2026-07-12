import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { TicketDetailsClient } from '@/components/rewards/TicketDetailsClient';

export default function RewardsTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Array.isArray(id) ? id[0] : id;

  if (!ticketId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#fff7f8',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text>Ticket not found.</Text>
      </View>
    );
  }

  return <TicketDetailsClient ticketId={ticketId} />;
}
