import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { InboxNotificationsSection } from '@/components/inbox/InboxNotificationsSection';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { useAuth } from '@/providers/auth';

export default function NotificationsPage() {
  const router = useRouter();
  const { session } = useAuth();
  return (
    <FullScreenSheet
      visible
      asRoute
      onClose={() => router.back()}
      title="Notifications"
      subtitle="Notifications and updates"
    >
      <View style={{ minHeight: 420 }}>
        <InboxNotificationsSection userId={session?.user.id ?? ''} />
      </View>
    </FullScreenSheet>
  );
}
