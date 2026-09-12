import { useRouter } from 'expo-router';
import { Copy } from 'lucide-react-native';
import { Pressable, Share, Text, View } from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { CLASSES } from '@/lib/consumer-classes';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { useEffectiveClass } from '@/lib/mock-class';
import { toast } from '@/lib/toast';
import { formatCompactCount } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

export default function PassportPage() {
  const router = useRouter();
  const { profile, consumerClass } = useAuth();
  const effective = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const classLabel =
    CLASSES.find((c) => c.id === effective.key)?.label ?? 'Bronze';
  const handle = effective.handle ?? profile?.instagram_handle ?? null;
  const igConnected = effective.origin === 'instagram' || Boolean(handle);
  const code = profile?.code ?? '—';

  async function copyCode() {
    if (!profile?.code) return;
    try {
      await Share.share({ message: profile.code });
    } catch {
      toast("Couldn't share the number");
    }
  }

  return (
    <FullScreenSheet
      visible
      asRoute
      onClose={() => router.back()}
      title="Your passport"
      subtitle="Who you are at Mesita, on one page."
    >
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <View className="border-b border-border px-4 py-3">
          <Text className="font-display text-lg font-semibold text-foreground">
            {profile?.full_name || 'Mesita member'}
          </Text>
        </View>
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <Text className="w-24 font-bold uppercase text-muted-foreground" style={{ fontSize: 10, letterSpacing: 1.2 }}>
            Number
          </Text>
          <View className="min-w-0 flex-1">
            <Text className="font-display font-semibold tabular-nums text-foreground">
              {code}
            </Text>
            <Text className="text-xs text-muted-foreground">
              Assigned once. Yours for good.
            </Text>
          </View>
          {profile?.code ? (
            <Pressable
              onPress={() => void copyCode()}
              accessibilityLabel="Copy member number"
              className="h-11 w-11 items-center justify-center rounded-xl"
            >
              <Copy color="#775254" size={16} />
            </Pressable>
          ) : null}
        </View>
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <Text className="w-24 font-bold uppercase text-muted-foreground" style={{ fontSize: 10, letterSpacing: 1.2 }}>
            Profile
          </Text>
          <View className="min-w-0 flex-1">
            <Text className="font-semibold text-foreground" numberOfLines={1}>
              {profile?.full_name || 'Mesita member'}
            </Text>
            <Text className="text-xs text-muted-foreground">
              Name, phone, birthday, photo
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push(CONSUMER_ROUTES.mePages.class)}
          className="flex-row items-center gap-3 border-b border-border px-4 py-3"
        >
          <Text className="w-24 font-bold uppercase text-muted-foreground" style={{ fontSize: 10, letterSpacing: 1.2 }}>
            Class
          </Text>
          <Text className="flex-1 font-semibold text-foreground">{classLabel}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(CONSUMER_ROUTES.mePages.instagram)}
          className="flex-row items-center gap-3 px-4 py-3"
        >
          <Text className="w-24 font-bold uppercase text-muted-foreground" style={{ fontSize: 10, letterSpacing: 1.2 }}>
            Instagram
          </Text>
          <View className="min-w-0 flex-1">
            <Text className="font-semibold text-foreground">
              {igConnected ? (handle ? `@${handle}` : 'Connected') : 'Not connected'}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {igConnected
                ? `${formatCompactCount(effective.followers)} followers`
                : 'Connect it to climb a class'}
            </Text>
          </View>
        </Pressable>
      </View>
    </FullScreenSheet>
  );
}
