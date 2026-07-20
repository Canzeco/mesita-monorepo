import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import type { SearchMapProps } from '@/components/search/SearchMap';
import { COLORS, GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import {
  MAP_MINIMAL_STYLES,
  MAP_PARTNER_PIN_COLOR,
  MAP_SELECTED_PIN_COLOR,
  MAP_WEB_PIN_COLOR,
  MONTERREY_CENTER,
} from '@/lib/map-defaults';


export function SearchMap({
  places,
  selectedId,
  userLocation,
  apiKey,
  onSelect,
  onMapPress,
}: SearchMapProps) {
  if (!apiKey) {
    return (
      <LinearGradient
        colors={[...GRADIENTS.hero]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <View className="items-center px-10">
          <View className="size-14 items-center justify-center rounded-2xl bg-primary/10">
            <MapPin color={COLORS.primary} size={28} />
          </View>
          <Text className="mt-3 font-display text-lg font-semibold text-foreground">
            Live map coming soon
          </Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            Set EXPO_PUBLIC_GMP_KEY for interactive Google Maps pins.
          </Text>
        </View>
      </LinearGradient>
    );
  }

  const center = userLocation ?? MONTERREY_CENTER;
  const region: Region = {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <MapView
      style={{ flex: 1 }}
      provider={PROVIDER_GOOGLE}
      customMapStyle={MAP_MINIMAL_STYLES}
      initialRegion={region}
      showsUserLocation={userLocation != null}
      showsMyLocationButton={false}
      onPress={onMapPress}
    >
      {places.map((place) => {
        if (place.lat == null || place.lng == null) return null;
        const selected = place.id === selectedId;
        const partner = place.listing_type === 'partner';
        return (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            pinColor={
              selected
                ? MAP_SELECTED_PIN_COLOR
                : partner
                  ? MAP_PARTNER_PIN_COLOR
                  : MAP_WEB_PIN_COLOR
            }
            onPress={(e) => {
              e.stopPropagation();
              onSelect(place.id);
            }}
          />
        );
      })}
    </MapView>
  );
}
