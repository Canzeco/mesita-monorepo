import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, MapPinPlus, Wand2 } from 'lucide-react-native';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';

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
      <View
        className="overflow-hidden rounded-2xl border border-border bg-card"
        style={{
          shadowColor: '#260409',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: '100%', height: 180 }}
            resizeMode="cover"
            accessibilityLabel={`${mainText} photo`}
          />
        ) : (
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              height: 140,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapPinPlus color="#fff" size={36} />
          </LinearGradient>
        )}
        <View style={{ padding: 16, gap: 4 }}>
          <Text
            className="font-bold text-foreground"
            style={{ fontSize: 20 }}
          >
            {mainText}
          </Text>
          {address ? (
            <Text className="text-muted-foreground" style={{ fontSize: 14 }}>
              {address}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void Linking.openURL(mapsUrl)}
            accessibilityRole="link"
            accessibilityLabel="Open in Google Maps"
            className="min-h-[44px] flex-row items-center gap-1.5 self-start py-2"
          >
            <ExternalLink color="#fb2b7b" size={14} />
            <Text
              className="font-semibold text-primary"
              style={{ fontSize: 13 }}
            >
              Open in Google Maps
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-4 rounded-2xl border border-border bg-card p-4">
        <View className="flex-row items-center gap-2">
          <Wand2 color="#fb2b7b" size={18} />
          <Text
            className="font-semibold text-foreground"
            style={{ fontSize: 15 }}
          >
            We’ll build its profile
          </Text>
        </View>
        <Text
          className="mt-2 text-muted-foreground"
          style={{ fontSize: 14, lineHeight: 20 }}
        >
          Adding creates a Mesita listing right away. Our AI enriches the
          profile in about five minutes.
        </Text>
      </View>
    </>
  );
}
