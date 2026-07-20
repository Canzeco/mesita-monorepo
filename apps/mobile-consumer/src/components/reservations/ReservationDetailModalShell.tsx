import { useRouter } from 'expo-router';
import { ArrowLeft, Share2 } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toast } from '@/lib/toast';

export function ReservationDetailModalShell({
  children,
  placeName,
  shareUrl,
}: {
  children: ReactNode;
  placeName: string;
  shareUrl?: string;
}) {
  const router = useRouter();

  async function onShare() {
    try {
      await Share.share({
        title: `${placeName} on Mesita`,
        message: shareUrl
          ? `My reservation at ${placeName}\n${shareUrl}`
          : `My reservation at ${placeName}`,
        url: shareUrl,
      });
    } catch {
      toast.error("Couldn't share reservation");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          className="size-10 items-center justify-center rounded-full bg-muted active:opacity-80"
        >
          <ArrowLeft color="#260409" size={20} />
        </Pressable>
        <Text className="min-w-0 flex-1 font-display text-lg font-semibold text-foreground">
          Reservation
        </Text>
        <Pressable
          onPress={() => void onShare()}
          accessibilityLabel="Share"
          className="h-9 w-9 items-center justify-center rounded-lg border border-border bg-card active:bg-muted"
        >
          <Share2 color="#260409" size={16} />
        </Pressable>
      </View>
      {children}
    </SafeAreaView>
  );
}
