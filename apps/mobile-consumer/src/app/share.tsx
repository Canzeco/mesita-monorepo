import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GiftCardDeck } from '@/components/me/GiftCardDeck';
import { ShellWash } from '@/components/ui/HeroBackdrop';

// Canonical /share referral surface — web /(shell)/share peer (#43).
export default function ShareScreen() {
  const router = useRouter();

  return (
    <ShellWash>
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/me');
            }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          >
            <ChevronLeft color="#260409" size={18} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text
              className="font-display font-bold text-foreground"
              style={{ fontSize: 18 }}
            >
              Share Mesita
            </Text>
            <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
              Your seat at the table — pass it on
            </Text>
          </View>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <GiftCardDeck />
        </ScrollView>
      </SafeAreaView>
    </ShellWash>
  );
}
