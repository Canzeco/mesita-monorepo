import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Store } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceDetailBody } from '@/components/place/PlaceDetailBody';
import { apiFetchPlaceDetail } from '@/lib/api/places';
import {
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
} from '@/lib/saved-places';
import { supabase } from '@/lib/supabase';
import type { PlaceDetail } from '@/lib/types/place-detail';

export default function PlaceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0] ?? '';

  const query = useQuery({
    queryKey: ['place-detail', id],
    queryFn: () => apiFetchPlaceDetail(supabase, id),
    enabled: Boolean(id),
  });

  const place = query.data ?? null;

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
        <View className="min-w-0 flex-1 flex-row items-center justify-center gap-1.5">
          <Text
            className="min-w-0 shrink font-display text-lg font-semibold text-foreground"
            numberOfLines={1}
          >
            {place?.name ?? 'Place'}
          </Text>
          {place?.listing_type === 'partner' ? (
            <View
              className="size-4 items-center justify-center rounded-full bg-[#0EA5E9]"
              accessibilityLabel="Mesita Partner"
            >
              <Text className="text-[9px] font-bold text-white">✓</Text>
            </View>
          ) : null}
        </View>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#fb2b7b" size="large" />
        </View>
      ) : !place ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Store color="#775254" size={28} />
          <Text className="font-display text-xl font-semibold text-foreground">
            Place not found
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-2 rounded-lg bg-foreground px-5 py-2.5"
          >
            <Text className="text-sm font-semibold text-background">Go back</Text>
          </Pressable>
        </View>
      ) : (
        // PlaceDetailBody owns its own scroll container so the tab strip can
        // pin (stickyHeaderIndices). flex-1 fills the space under the header.
        <PlaceDetailBody
          place={place}
          onSaveToggle={(next) => {
            if (next) upsertSavedPlacePreview(placeDetailToPreview(place));
            else removeSavedPlacePreview(place.id);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function placeDetailToPreview(place: PlaceDetail) {
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    category: place.category || null,
    vibe: place.vibe || null,
    price_level: place.price_level,
    currency: place.currency,
    listing_type: place.listing_type,
    status: 'active' as const,
    fiscal_type: 'formal' as const,
    plan: 'free' as const,
    lat: place.lat,
    lng: place.lng,
    address: place.address || null,
    closes_at: place.closes_at || null,
    phone: place.phone ?? null,
    pitch: place.pitch,
    story: place.story,
    photos: place.photos,
    website_url: place.channels.website_url ?? null,
    instagram_url: place.channels.instagram_url ?? null,
    facebook_url: place.channels.facebook_url ?? null,
    whatsapp_url: place.channels.whatsapp_url ?? null,
    opentable_url: place.reservations.opentable_url ?? null,
    resy_url: place.reservations.resy_url ?? null,
    uber_eats_url: place.reservations.uber_eats_url ?? null,
    x_url: place.channels.x_url ?? null,
    threads_url: place.channels.threads_url ?? null,
    reddit_url: place.channels.reddit_url ?? null,
    didi_food_url: place.reservations.didi_food_url ?? null,
    google_maps_url: place.reviews_maps.google_maps_url ?? null,
    email: place.email ?? null,
    created_at: new Date().toISOString(),
    google_rating: place.google.rating,
    google_count: place.google.count,
    instagram_followers_count: place.instagram.followers,
    price_range: place.price_range,
    open_now: place.open_now,
    opens_at: place.opens_at,
    zone: place.zone,
    is_first_visit: place.promo_matrix.is_first_visit,
    welcome_free_rate: place.promo_matrix.welcome.free,
    welcome_premium_rate: place.promo_matrix.welcome.premium,
    free_rate: place.promo_matrix.default.free,
    premium_rate: place.promo_matrix.default.premium,
  };
}
