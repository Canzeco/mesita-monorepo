import { QrCode } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Parked on the web too (BottomNav soon=true, MESITA-383) — same copy.
export default function RewardsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-8">
        <View className="size-12 items-center justify-center rounded-xl bg-primary/10">
          <QrCode color="#fb2b7b" size={22} />
        </View>
        <Text className="mt-4 font-display text-2xl text-foreground">Rewards coming soon</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
          Pay with QR and claim Mesita rewards from here shortly. Hang tight.
        </Text>
      </View>
    </SafeAreaView>
  );
}
