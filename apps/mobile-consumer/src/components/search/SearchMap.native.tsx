import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import type { SearchMapProps } from '@/components/search/SearchMap';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { MONTERREY_CENTER } from '@/lib/map-defaults';
import {
  pinFillColor,
  placeMembershipTone,
  type MembershipTone,
} from '@/lib/search-membership';

function MembershipDot({
  tone,
  selected,
}: {
  tone: MembershipTone;
  selected: boolean;
}) {
  const size = selected ? 22 : 16;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: pinFillColor(tone, selected),
        borderWidth: 2,
        borderColor: '#ffffff',
      }}
    />
  );
}

export function SearchMap({
  places,
  selectedId,
  userLocation,
  center,
  apiKey,
  pins,
  onSelectPlace,
  onOpenPlace,
  onSelectPin,
  onMapPress,
  onMapDrag,
}: SearchMapProps) {
  const mapRef = useRef<MapView>(null);

  const overlaySelected = pins?.find((p) => p.id === selectedId) ?? null;
  const catalogSelected = selectedId
    ? (places.find((p) => p.id === selectedId) ?? null)
    : null;
  const selLat = overlaySelected?.lat ?? catalogSelected?.lat ?? null;
  const selLng = overlaySelected?.lng ?? catalogSelected?.lng ?? null;
  useEffect(() => {
    if (selLat == null || selLng == null) return;
    mapRef.current?.animateCamera(
      { center: { latitude: selLat, longitude: selLng } },
      { duration: 350 },
    );
  }, [selLat, selLng]);

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
      onPanDrag={onMapDrag}
    >
      {pins != null
        ? pins.map((pin) => {
            const selected = pin.id === selectedId;
            return (
              <Marker
                key={pin.id}
                coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                title={pin.title}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={selected ? 10 : 0}
                onPress={(e) => {
                  e.stopPropagation();
                  onSelectPin?.(pin);
                }}
              >
                <MembershipDot tone={pin.tone} selected={selected} />
              </Marker>
            );
          })
        : places.map((place) => {
            if (place.lat == null || place.lng == null) return null;
            const selected = place.id === selectedId;
            return (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.lat, longitude: place.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={selected ? 10 : 0}
                onPress={(e) => {
                  e.stopPropagation();
                  if (selected) onOpenPlace(place);
                  else onSelectPlace(place);
                }}
              >
                <MembershipDot
                  tone={placeMembershipTone(place)}
                  selected={selected}
                />
              </Marker>
            );
          })}
    </MapView>
  );
}
