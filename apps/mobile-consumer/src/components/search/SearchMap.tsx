import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import type { MembershipTone } from '@/lib/search-membership';

type Coords = { lat: number; lng: number };

export type SearchMapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  tone: MembershipTone;
};

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
  pins?: SearchMapPin[] | null;
  /** First tap selects; already-selected tap opens (web SearchMap parity). */
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  onSelectPin?: (pin: SearchMapPin) => void;
  onMapPress?: () => void;
  /** User finger-drag. Rail / pin pans must not fire this. */
  onMapDrag?: () => void;
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
