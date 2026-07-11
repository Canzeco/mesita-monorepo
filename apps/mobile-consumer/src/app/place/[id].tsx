import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CalendarCheck,
  Clock,
  Gift,
  Globe,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Star,
  Store,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { apiFetchPlaceDetail } from '@/lib/api/places';
import { formatPlacePriceChip } from '@/lib/place-price';
import { getOpeningStatusLabel } from '@/lib/place-status';
import { resolvePromoRateFromPlaceRow } from '@/lib/promo-rates';
import {
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from '@/lib/saved-places';
import { supabase } from '@/lib/supabase';
import type { PlaceDetail } from '@/lib/types/place-detail';
import {
  firstInitial,
  formatCompactCount,
  formatRating,
} from '@/lib/utils';

type Tab = 'place' | 'rewards';

export default function PlaceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0] ?? '';
  const [tab, setTab] = useState<Tab>('place');
  const { isSaved, setSaved } = useSavedPlaces();

  const query = useQuery({
    queryKey: ['place-detail', id],
    queryFn: () => apiFetchPlaceDetail(supabase, id),
    enabled: Boolean(id),
  });

  const place = query.data ?? null;
  const saved = place ? isSaved(place.id) : false;

  const toggleSave = () => {
    if (!place) return;
    const next = !saved;
    setSaved(place.id, next);
    if (next) {
      upsertSavedPlacePreview({
        id: place.id,
        slug: place.slug,
        name: place.name,
        category: place.category || null,
        vibe: place.vibe || null,
        price_level: place.price_level,
        currency: place.currency,
        listing_type: place.listing_type,
        status: 'active',
        fiscal_type: 'formal',
        plan: 'free',
        lat: place.lat,
        lng: place.lng,
        address: place.address || null,
        closes_at: place.closes_at,
        phone: place.phone,
        pitch: place.pitch,
        story: place.story,
        photos: place.photos,
        website_url: place.website_url,
        instagram_url: place.instagram_url,
        facebook_url: null,
        whatsapp_url: place.whatsapp_url,
        opentable_url: null,
        resy_url: null,
        uber_eats_url: null,
        x_url: null,
        threads_url: null,
        reddit_url: null,
        didi_food_url: null,
        google_maps_url: place.google_maps_url,
        email: null,
        created_at: new Date().toISOString(),
        google_rating: place.google_rating,
        google_count: place.google_count,
        instagram_followers_count: place.instagram_followers,
        price_range: place.price_range,
        open_now: place.open_now,
        opens_at: place.opens_at,
        zone: place.zone,
        is_first_visit: place.is_first_visit,
        welcome_free_rate: place.welcome_free_rate,
        welcome_premium_rate: place.welcome_premium_rate,
        free_rate: place.free_rate,
        premium_rate: place.premium_rate,
      });
    } else {
      removeSavedPlacePreview(place.id);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-border px-3 py-2.5">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          className="size-10 items-center justify-center rounded-full bg-muted active:opacity-80"
        >
          <ArrowLeft color="#260409" size={20} />
        </Pressable>
        <Text
          className="min-w-0 flex-1 font-display text-lg font-semibold text-foreground"
          numberOfLines={1}
        >
          {place?.name ?? 'Place'}
        </Text>
        {place?.listing_type === 'partner' ? (
          <View className="rounded-full bg-primary/10 px-2.5 py-1">
            <Text className="text-[10px] font-bold tracking-wide text-primary uppercase">
              Partner
            </Text>
          </View>
        ) : null}
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
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-10"
          showsVerticalScrollIndicator={false}
        >
          <Hero place={place} />
          <Summary place={place} />
          <ActionRow
            saved={saved}
            onSave={toggleSave}
            onContact={() => openContact(place)}
            onReserve={() =>
              Alert.alert('Reserve', 'Reservations are coming soon.')
            }
            onShare={() => Alert.alert('Share', 'Sharing is coming soon.')}
          />

          <View className="mt-4 flex-row border-b border-border px-2">
            {(
              [
                { key: 'place', label: 'Place' },
                { key: 'rewards', label: 'Rewards' },
              ] as const
            ).map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  className={`flex-1 items-center border-b-2 py-3 ${
                    active ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      active ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="gap-3 px-4 pt-4">
            {tab === 'place' ? <PlaceTab place={place} /> : <RewardsTab place={place} />}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Hero({ place }: { place: PlaceDetail }) {
  const photo = place.photos[0];
  return (
    <View className="h-56 w-full bg-muted">
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text className="font-display text-5xl font-bold text-white/85">
            {firstInitial(place.name)}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

function Summary({ place }: { place: PlaceDetail }) {
  const rating = formatRating(place.google_rating);
  const price = formatPlacePriceChip(place.price_range, place.price_level);
  const opening = getOpeningStatusLabel(place);
  const meta = [place.category, place.zone, price].filter(Boolean).join(' · ');

  return (
    <View className="gap-2 px-4 pt-4">
      <Text className="font-display text-2xl font-bold text-foreground">
        {place.name}
      </Text>
      {meta ? (
        <Text className="text-sm text-muted-foreground">{meta}</Text>
      ) : null}
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        {rating ? (
          <View className="flex-row items-center gap-1">
            <Star color="#f59e0b" fill="#f59e0b" size={14} />
            <Text className="text-sm font-semibold text-foreground">
              {rating}
            </Text>
            {place.google_count != null ? (
              <Text className="text-xs text-muted-foreground">
                ({formatCompactCount(place.google_count, true)})
              </Text>
            ) : null}
          </View>
        ) : null}
        {opening ? (
          <View className="flex-row items-center gap-1.5">
            <View
              className={`size-1.5 rounded-full ${
                place.open_now === true
                  ? 'bg-emerald-500'
                  : 'bg-muted-foreground/40'
              }`}
            />
            <Text
              className={`text-xs font-medium ${
                place.open_now === true
                  ? 'text-emerald-600'
                  : 'text-muted-foreground'
              }`}
            >
              {opening}
            </Text>
          </View>
        ) : null}
      </View>
      {place.pitch ? (
        <Text className="mt-1 text-sm leading-relaxed text-foreground/80">
          {place.pitch}
        </Text>
      ) : null}
    </View>
  );
}

function ActionRow({
  saved,
  onSave,
  onContact,
  onReserve,
  onShare,
}: {
  saved: boolean;
  onSave: () => void;
  onContact: () => void;
  onReserve: () => void;
  onShare: () => void;
}) {
  return (
    <View className="mt-4 flex-row gap-2 px-4">
      <ActionChip
        label={saved ? 'Saved' : 'Save'}
        Icon={Heart}
        onPress={onSave}
        primary={saved}
        filled={saved}
      />
      <ActionChip label="Contact" Icon={MessageCircle} onPress={onContact} />
      <ActionChip label="Reserve" Icon={CalendarCheck} onPress={onReserve} muted />
      <ActionChip label="Share" Icon={Share2} onPress={onShare} muted />
    </View>
  );
}

function ActionChip({
  label,
  Icon,
  onPress,
  primary,
  filled,
  muted,
}: {
  label: string;
  Icon: typeof Heart;
  onPress: () => void;
  primary?: boolean;
  filled?: boolean;
  muted?: boolean;
}) {
  if (primary) {
    return (
      <Pressable
        onPress={onPress}
        className="h-11 flex-1 overflow-hidden rounded-xl active:opacity-90"
      >
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Icon color="#fff" size={15} fill={filled ? '#fff' : 'transparent'} />
          <Text className="text-xs font-semibold text-white">{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className={`h-11 flex-1 flex-row items-center justify-center gap-1 rounded-xl border border-border ${
        muted ? 'bg-muted/40' : 'bg-card active:bg-muted'
      }`}
    >
      <Icon color={muted ? '#77525499' : '#775254'} size={15} />
      <Text
        className={`text-xs font-medium ${
          muted ? 'text-muted-foreground/70' : 'text-foreground/80'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PlaceTab({ place }: { place: PlaceDetail }) {
  return (
    <>
      {place.address || place.zone ? (
        <InfoCard title="Location" Icon={MapPin}>
          <Text className="text-sm leading-relaxed text-foreground">
            {[place.address, place.zone].filter(Boolean).join('\n')}
          </Text>
          {place.google_maps_url ? (
            <Pressable
              onPress={() => void Linking.openURL(place.google_maps_url!)}
              className="mt-2 self-start"
            >
              <Text className="text-sm font-semibold text-primary">
                Open in Maps
              </Text>
            </Pressable>
          ) : null}
        </InfoCard>
      ) : null}

      <InfoCard title="Hours" Icon={Clock}>
        <Text className="text-sm text-foreground">
          {getOpeningStatusLabel(place) ?? 'Hours not listed yet'}
        </Text>
      </InfoCard>

      {(place.website_url ||
        place.instagram_url ||
        place.phone ||
        place.whatsapp_url) && (
        <InfoCard title="Links" Icon={Globe}>
          <View className="gap-2">
            {place.website_url ? (
              <LinkRow
                label="Website"
                onPress={() => void Linking.openURL(place.website_url!)}
              />
            ) : null}
            {place.instagram_url ? (
              <LinkRow
                label="Instagram"
                onPress={() => void Linking.openURL(place.instagram_url!)}
              />
            ) : null}
            {place.phone ? (
              <LinkRow
                label={place.phone}
                onPress={() => void Linking.openURL(`tel:${place.phone}`)}
              />
            ) : null}
            {place.whatsapp_url ? (
              <LinkRow
                label="WhatsApp"
                onPress={() => void Linking.openURL(place.whatsapp_url!)}
              />
            ) : null}
          </View>
        </InfoCard>
      )}

      {place.story ? (
        <InfoCard title="About" Icon={Store}>
          <Text className="text-sm leading-relaxed text-foreground/85">
            {place.story}
          </Text>
        </InfoCard>
      ) : null}

      {place.tags.length > 0 ? (
        <InfoCard title="Tags" Icon={Gift}>
          <View className="flex-row flex-wrap gap-1.5">
            {place.tags.slice(0, 16).map((t) => (
              <View
                key={t.slug}
                className="rounded-full bg-muted px-2.5 py-1"
              >
                <Text className="text-[11px] font-medium text-foreground/80">
                  {t.label}
                </Text>
              </View>
            ))}
          </View>
        </InfoCard>
      ) : null}
    </>
  );
}

function RewardsTab({ place }: { place: PlaceDetail }) {
  const isPartner = place.listing_type === 'partner';
  const promo = useMemo(
    () =>
      isPartner
        ? resolvePromoRateFromPlaceRow(
            place as unknown as Record<string, unknown>,
            place.is_first_visit !== false,
            false,
          )
        : null,
    [isPartner, place],
  );

  if (!isPartner) {
    return (
      <InfoCard title="Rewards" Icon={Gift}>
        <Text className="text-sm leading-relaxed text-muted-foreground">
          This place is listed on Mesita but doesn’t offer partner rewards yet.
        </Text>
      </InfoCard>
    );
  }

  if (promo == null) {
    return (
      <InfoCard title="Rewards" Icon={Gift}>
        <Text className="text-sm leading-relaxed text-muted-foreground">
          Partner place — reward rates aren’t configured yet.
        </Text>
      </InfoCard>
    );
  }

  return (
    <View
      className="overflow-hidden rounded-2xl border border-border bg-card p-5"
      style={SHADOW_ELEV}
    >
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{
          alignSelf: 'flex-start',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}
      >
        <Text className="text-2xl font-black text-white">{promo}% OFF</Text>
      </LinearGradient>
      <Text className="mt-3 font-display text-lg font-semibold text-foreground">
        Your Mesita reward
      </Text>
      <Text className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Show your Mesita code at the place to redeem. Premium members unlock
        higher rates on the web.
      </Text>
    </View>
  );
}

function InfoCard({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <View
      className="rounded-2xl border border-border bg-card p-4"
      style={SHADOW_ELEV}
    >
      <View className="mb-2 flex-row items-center gap-2">
        <View className="size-8 items-center justify-center rounded-full bg-primary/10">
          <Icon color="#fb2b7b" size={16} />
        </View>
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-2 py-1">
      <Phone color="#775254" size={14} />
      <Text className="text-sm font-medium text-primary">{label}</Text>
    </Pressable>
  );
}

function openContact(place: PlaceDetail) {
  const options: { text: string; onPress?: () => void }[] = [];
  if (place.phone) {
    options.push({
      text: 'Call',
      onPress: () => void Linking.openURL(`tel:${place.phone}`),
    });
  }
  if (place.whatsapp_url) {
    options.push({
      text: 'WhatsApp',
      onPress: () => void Linking.openURL(place.whatsapp_url!),
    });
  }
  if (place.instagram_url) {
    options.push({
      text: 'Instagram',
      onPress: () => void Linking.openURL(place.instagram_url!),
    });
  }
  if (place.website_url) {
    options.push({
      text: 'Website',
      onPress: () => void Linking.openURL(place.website_url!),
    });
  }
  if (options.length === 0) {
    Alert.alert(place.name, 'No contact links available yet.');
    return;
  }
  options.push({ text: 'Cancel', onPress: () => undefined });
  Alert.alert('Contact', place.name, options);
}
