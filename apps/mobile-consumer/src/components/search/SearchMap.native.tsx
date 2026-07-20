import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
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
  onSelectPlace,
  onOpenPlace,
  onMapPress,
}: SearchMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const center = userLocation ?? MONTERREY_CENTER;
  const region: Region = {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  const selectedLat =
    selectedId != null
      ? places.find((p) => p.id === selectedId)?.lat
      : null;
  const selectedLng =
    selectedId != null
      ? places.find((p) => p.id === selectedId)?.lng
      : null;

  useEffect(() => {
    if (
      !apiKey ||
      selectedId == null ||
      selectedLat == null ||
      selectedLng == null
    ) {
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: selectedLat,
        longitude: selectedLng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      280,
    );
  }, [apiKey, selectedId, selectedLat, selectedLng]);

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

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      provider={PROVIDER_GOOGLE}
      customMapStyle={MAP_MINIMAL_STYLES}
      initialRegion={region}
      showsUserLocation={userLocation != null}
      showsMyLocationButton={false}
      accessibilityLabel="Search map"
      onPress={onMapPress}
    >
      {places.map((place) => {
        if (place.lat == null || place.lng == null) return null;
        const isSelected = place.id === selectedId;
        const partner = place.listing_type === 'partner';
        return (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            title={place.name}
            pinColor={
              isSelected
                ? MAP_SELECTED_PIN_COLOR
                : partner
                  ? MAP_PARTNER_PIN_COLOR
                  : MAP_WEB_PIN_COLOR
            }
            accessibilityLabel={`${place.name}${
              isSelected ? ', selected' : ''
            }. ${isSelected ? 'Tap to open' : 'Tap to select'}`}
            onPress={(e) => {
              e.stopPropagation();
              if (isSelected) onOpenPlace(place);
              else onSelectPlace(place);
            }}
          />
        );
      })}
    </MapView>
  );
}
