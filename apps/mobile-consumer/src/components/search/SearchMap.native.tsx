import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import type { SearchMapProps } from '@/components/search/SearchMap';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import {
  MAP_PARTNER_PIN_COLOR,
  MAP_SELECTED_PIN_COLOR,
  MAP_WEB_PIN_COLOR,
  MONTERREY_CENTER,
} from '@/lib/map-defaults';

export function SearchMap({
  places,
  selectedId,
  userLocation,
  center,
  apiKey,
  onSelect,
  onMapPress,
}: SearchMapProps) {
  const mapRef = useRef<MapView>(null);

  // Pan to whichever pin / rail card / on-Mesita result the consumer just
  // picked. Primitive lat/lng deps (not the place object) so the camera moves
  // only when the SELECTION changes — re-renders must never fight the user's
  // panning. animateCamera pans without resetting the current zoom (mirrors
  // web SearchMap's PanTo).
  const selected = selectedId
    ? (places.find((p) => p.id === selectedId) ?? null)
    : null;
  const selLat = selected?.lat ?? null;
  const selLng = selected?.lng ?? null;
  useEffect(() => {
    if (selLat == null || selLng == null) return;
    mapRef.current?.animateCamera(
      { center: { latitude: selLat, longitude: selLng } },
      { duration: 350 },
    );
  }, [selLat, selLng]);

  // Recenter on the searched zone or the device location once it resolves —
  // primitive deps so it fires on the center CHANGE, not every render (mirrors
  // web SearchMap's Recentre).
  const cLat = center?.lat ?? null;
  const cLng = center?.lng ?? null;
  useEffect(() => {
    if (cLat == null || cLng == null) return;
    mapRef.current?.animateCamera(
      { center: { latitude: cLat, longitude: cLng } },
      { duration: 350 },
    );
  }, [cLat, cLng]);

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
            <MapPin color="#fb2b7b" size={28} />
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

  const initial = center ?? userLocation ?? MONTERREY_CENTER;
  const region: Region = {
    latitude: initial.lat,
    longitude: initial.lng,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      provider={PROVIDER_GOOGLE}
      initialRegion={region}
      showsUserLocation={userLocation != null}
      showsMyLocationButton={false}
      onPress={onMapPress}
    >
      {places.map((place) => {
        if (place.lat == null || place.lng == null) return null;
        const selectedPin = place.id === selectedId;
        const partner = place.listing_type === 'partner';
        return (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            pinColor={
              selectedPin
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
