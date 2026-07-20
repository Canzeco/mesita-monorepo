import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import type { Place } from '@/lib/api/places';

type Coords = { lat: number; lng: number };

export type SearchMapProps = {
  places: Place[];
  selectedId: string | null;
  userLocation: Coords | null;
  /**
   * Recenter target — the searched zone center when set, else the device
   * location. The native map pans to it when it changes (web stub ignores it).
   */
  center?: Coords | null;
  apiKey: string;
  onSelect: (placeId: string) => void;
  onMapPress?: () => void;
};

/**
 * Default / web stub. Native builds resolve `SearchMap.native.tsx` instead
 * (Google provider). Suggest + rail + add work without a live map.
 */
export function SearchMap(_props: SearchMapProps) {
  return (
    <LinearGradient
      colors={[...GRADIENTS.hero]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <View className="items-center px-10">
        <View className="size-14 items-center justify-center rounded-2xl bg-primary/10">
          <MapPin color="#fb2b7b" size={28} />
        </View>
        <Text className="mt-3 font-display text-lg font-semibold text-foreground">
          Live map coming soon
        </Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          Search and add places work now — map pins land with Maps SDK keys.
        </Text>
      </View>
    </LinearGradient>
  );
}
