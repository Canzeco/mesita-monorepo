import { Image } from 'expo-image';
import { ExternalLink, MapPinPlus } from 'lucide-react-native';
import { Linking, Pressable, Text, View } from 'react-native';

import { COLORS } from '@/constants/brand';

/** Body chrome for GooglePlaceSheet — mirrors web GooglePlaceSheet layout. */
export function GooglePlacePreview({
  mainText,
  photoUrl,
  address,
  mapsUrl,
}: {
  mainText: string;
  photoUrl?: string;
  address: string | null;
  mapsUrl: string;
}) {
  return (
    <>
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <MapPinPlus color={COLORS.primary} size={20} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-display text-lg font-semibold leading-tight text-foreground">
            {mainText}
          </Text>
          {address ? (
            <Text className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {address}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void Linking.openURL(mapsUrl)}
            accessibilityRole="link"
            accessibilityLabel="View on Google Maps"
            className="mt-1.5 min-h-[44px] flex-row items-center gap-1 self-start"
          >
            <Text className="text-xs font-semibold text-primary">
              View on Google Maps
            </Text>
            <ExternalLink color={COLORS.primary} size={12} />
          </Pressable>
        </View>
      </View>

      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{
            marginTop: 16,
            width: '100%',
            aspectRatio: 5 / 2,
            borderRadius: 16,
          }}
          contentFit="cover"
          accessibilityLabel={`${mainText} — photo from Google`}
        />
      ) : null}

      <View className="mt-4 rounded-2xl bg-muted/60 px-4 py-3">
        <Text className="text-sm font-semibold text-foreground">
          This place isn’t on Mesita yet.
        </Text>
        <Text className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Google knows it, but its Mesita profile hasn’t been built. Add it and
          our AI will generate the full page — photos, ratings, and details —
          in about 5 minutes.
        </Text>
      </View>
    </>
  );
}
