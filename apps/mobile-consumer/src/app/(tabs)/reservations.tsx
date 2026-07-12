import { CalendarCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShellWash } from '@/components/ui/HeroBackdrop';

// Deep-link / fallback surface. Tab taps open ComingSoonModal via
// ConsumerTabBar (web BottomNav parity) and never land here in normal use.
export default function ReservationsScreen() {
  return (
    <ShellWash>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <CalendarCheck color="#775254" size={24} strokeWidth={1.75} />
          </View>
          <Text
            className="mt-4 text-center font-semibold text-foreground"
            style={{ fontSize: 16 }}
          >
            Reservations coming soon
          </Text>
          <Text
            className="mt-1.5 max-w-[280px] text-center text-muted-foreground"
            style={{ fontSize: 14, lineHeight: 20 }}
          >
            Your bookings will live here. For now, reach places from Contact on
            a place.
          </Text>
        </View>
      </SafeAreaView>
    </ShellWash>
  );
}
