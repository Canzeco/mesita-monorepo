import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TicketScreen } from '@/components/rewards/TicketScreen';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { useAuth } from '@/providers/auth';

// THE ticket (MESITA-857): one full-screen object for the whole lifecycle.
export default function RewardsTicketRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Array.isArray(id) ? id[0] : id;
  const { session } = useAuth();

  if (!ticketId || !session?.user) {
    return (
      <ShellWash>
        <SafeAreaView className="flex-1 items-center justify-center">
          <View className="p-6">
            <Text className="font-semibold text-foreground" style={{ fontSize: 16 }}>
              {ticketId ? 'Sign in to see your ticket' : 'Ticket not found.'}
            </Text>
          </View>
        </SafeAreaView>
      </ShellWash>
    );
  }

  return (
    <ShellWash>
      <SafeAreaView className="flex-1" edges={['top']}>
        <TicketScreen userId={session.user.id} ticketId={ticketId} />
      </SafeAreaView>
    </ShellWash>
  );
}
