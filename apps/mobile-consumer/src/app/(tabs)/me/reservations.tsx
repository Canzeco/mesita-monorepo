import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { InboxReservationsSection } from '@/components/inbox/InboxReservationsSection';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';

export default function ReservationsPage() {
  const router = useRouter();
  return (
    <FullScreenSheet
      visible
      asRoute
      onClose={() => router.back()}
      title="Reservations"
      subtitle="Upcoming first, then past"
    >
      <View style={{ minHeight: 420 }}>
        <InboxReservationsSection />
      </View>
    </FullScreenSheet>
  );
}
