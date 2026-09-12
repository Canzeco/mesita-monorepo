import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { InboxVisitsSection } from '@/components/inbox/InboxVisitsSection';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { useAuth } from '@/providers/auth';

export default function VisitsPage() {
  const router = useRouter();
  const { session } = useAuth();
  return (
    <FullScreenSheet
      visible
      asRoute
      onClose={() => router.back()}
      title="Visits"
      subtitle="Live ones first, then everything you've closed"
    >
      <View style={{ minHeight: 420 }}>
        <InboxVisitsSection userId={session?.user.id ?? ''} />
      </View>
    </FullScreenSheet>
  );
}
