import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BadgeCheck,
  CalendarCheck,
  Camera,
  Clock,
  Gift,
  Globe,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Star,
  type LucideIcon,
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ComingSoonModal } from '@/components/ui/ComingSoonModal';
import { PlaceContactSheet } from '@/components/place/PlaceContactSheet';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { formatPlacePriceChip } from '@/lib/place-price';
import { resolvePromoRateFromPlaceRow } from '@/lib/promo-rates';
import { useSavedPlaces } from '@/lib/saved-places';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { firstInitial, formatCompactCount, formatDistanceKm, formatRating } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

export function ProfileSummary({
  place,
  onSaveToggle,
}: {
  place: PlaceDetail;
  onSaveToggle?: (saved: boolean) => void;
}) {
  const googleRating = formatRating(place.google.rating) ?? '—';
  const googleCount = formatCompactCount(place.google.count, false);
  const igFollowers = formatCompactCount(place.instagram.followers, false);
  const priceLabel = formatPlacePriceChip({
    priceRange: place.price_range,
    priceLevel: place.price_level,
    currency: place.currency,
  });
  const statusValue = place.open_now
    ? `Open · until ${place.closes_at || '—'}`
    : `Closed · opens ${place.opens_at || '—'}`;
  const isPartner = place.listing_type === 'partner';

  return (
    <View className="gap-3 border-b border-border bg-card px-4 pt-3 pb-4">
      <View className="flex-row items-center gap-4">
        <View className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border border-border">
          {place.photos.length > 0 ? (
            <Image
              source={{ uri: place.photos[0] }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={[...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text className="font-display text-3xl font-bold text-white/80">
                {firstInitial(place.name)}
              </Text>
            </LinearGradient>
          )}
        </View>
        <View className="min-w-0 flex-1 flex-row">
          <ProfileStat
            value={googleRating}
            label={`${googleCount} Google`}
            star
          />
          <ProfileStat
            value={igFollowers}
            label="Instagram"
            ig
          />
          <ProfileRewardStat place={place} />
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        {place.is_enriching ? (
          <View className="flex-row items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50 px-2.5 py-1">
            <ActivityIndicator color="#059669" size="small" />
            <Text className="text-[11.5px] font-semibold text-emerald-900">
              Enriching
            </Text>
          </View>
        ) : null}
        <ProfileMetaChip>
          {isPartner ? (
            <>
              <BadgeCheck color="#0ea5e9" size={14} fill="#0ea5e9" />
              <Text className="text-[11.5px] font-semibold text-foreground">
                Verified Partner
              </Text>
            </>
          ) : (
            <>
              <Globe color="#775254" size={14} />
              <Text className="text-[11.5px] font-semibold text-foreground">
                Not Verified
              </Text>
            </>
          )}
        </ProfileMetaChip>
        {place.category ? (
          <ProfileMetaChip>
            <Text className="text-[11.5px] font-semibold text-foreground">
              {place.category}
            </Text>
          </ProfileMetaChip>
        ) : null}
        {priceLabel ? (
          <ProfileMetaChip>
            <Text className="text-[11.5px] font-semibold text-foreground">
              {priceLabel}
            </Text>
          </ProfileMetaChip>
        ) : null}
        <ProfileMetaChip>
          <MapPin color="#775254" size={12} />
          <Text
            className="max-w-[160px] text-[11.5px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {place.zone || '—'}
          </Text>
        </ProfileMetaChip>
        <ProfileMetaChip>
          <Navigation color="#775254" size={12} />
          <Text className="text-[11.5px] font-semibold text-foreground">
            {formatDistanceKm(place.distance_km)}
          </Text>
        </ProfileMetaChip>
        <ProfileMetaChip>
          <Clock
            color={place.open_now ? '#059669' : '#775254'}
            size={12}
          />
          <Text
            className={`text-[11.5px] font-semibold ${
              place.open_now ? 'text-emerald-700' : 'text-foreground'
            }`}
          >
            {statusValue}
          </Text>
        </ProfileMetaChip>
        <PromoMetaChip place={place} />
      </View>

      <ProfileActions place={place} onSaveToggle={onSaveToggle} />
    </View>
  );
}

function ProfileStat({
  value,
  label,
  star,
  ig,
  gift,
}: {
  value: string;
  label: string;
  star?: boolean;
  ig?: boolean;
  gift?: boolean;
}) {
  return (
    <View className="min-w-0 flex-1 items-center px-0.5">
      <View className="flex-row items-center gap-0.5">
        {star ? <Star color="#f59e0b" fill="#f59e0b" size={12} /> : null}
        {ig ? <Camera color="#ec4899" size={12} /> : null}
        {gift ? <Gift color="#0ea5e9" size={12} /> : null}
        <Text className="text-[17px] font-bold tabular-nums text-foreground">
          {value}
        </Text>
      </View>
      <Text
        className="mt-0.5 text-[10px] font-medium text-muted-foreground"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function ProfileRewardStat({ place }: { place: PlaceDetail }) {
  const { consumerClass } = useAuth();
  const isPremium = consumerClass?.class === 'premium';
  const isFirstVisit = place.promo_matrix.is_first_visit;
  const promoPercent = resolvePromoRateFromPlaceRow(
    {
      listing_type: place.listing_type,
      welcome_free_rate: place.promo_matrix.welcome.free,
      welcome_premium_rate: place.promo_matrix.welcome.premium,
      free_rate: place.promo_matrix.default.free,
      premium_rate: place.promo_matrix.default.premium,
      is_first_visit: isFirstVisit,
    },
    isFirstVisit,
    isPremium,
  );
  if (promoPercent == null) {
    return <ProfileStat value="—" label="No reward" gift />;
  }
  return (
    <ProfileStat
      value={`${promoPercent}%`}
      label={isFirstVisit ? 'Welcome' : 'Returning'}
      gift
    />
  );
}

function ProfileMetaChip({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
      {children}
    </View>
  );
}

function PromoMetaChip({ place }: { place: PlaceDetail }) {
  const { consumerClass } = useAuth();
  const isPremium = consumerClass?.class === 'premium';
  const rate = resolvePromoRateFromPlaceRow(
    {
      listing_type: place.listing_type,
      welcome_free_rate: place.promo_matrix.welcome.free,
      welcome_premium_rate: place.promo_matrix.welcome.premium,
      free_rate: place.promo_matrix.default.free,
      premium_rate: place.promo_matrix.default.premium,
      is_first_visit: place.promo_matrix.is_first_visit,
    },
    place.promo_matrix.is_first_visit,
    isPremium,
  );
  return (
    <ProfileMetaChip>
      <Gift color={rate != null ? '#0ea5e9' : '#775254'} size={12} />
      <Text className="text-[11.5px] font-semibold text-foreground">
        {rate != null ? `${rate}% off` : 'No reward'}
      </Text>
    </ProfileMetaChip>
  );
}

function ProfileActions({
  place,
  onSaveToggle,
}: {
  place: PlaceDetail;
  onSaveToggle?: (saved: boolean) => void;
}) {
  const { isSaved, setSaved } = useSavedPlaces();
  const [contactOpen, setContactOpen] = useState(false);
  const [soonKind, setSoonKind] = useState<'reserve' | 'share' | null>(null);
  const hasWhatsApp = Boolean(place.channels.whatsapp_url);
  const saved = isSaved(place.id);

  function onSave() {
    const next = !saved;
    setSaved(place.id, next);
    onSaveToggle?.(next);
  }

  return (
    <>
      <View className="mt-5 flex-row gap-2">
        <ActionBtn
          label={saved ? 'Saved' : 'Save'}
          onPress={onSave}
          saved={saved}
          Icon={Heart}
          filled={saved}
        />
        <ActionBtn
          label="Contact"
          onPress={() => setContactOpen(true)}
          Icon={hasWhatsApp ? MessageCircle : Phone}
        />
        <ActionBtn
          label="Reserve"
          onPress={() => setSoonKind('reserve')}
          Icon={CalendarCheck}
        />
        <ActionBtn
          label="Share"
          onPress={() => setSoonKind('share')}
          Icon={Share2}
        />
      </View>
      <PlaceContactSheet
        place={place}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
      />
      <ComingSoonModal
        open={soonKind === 'reserve'}
        onClose={() => setSoonKind(null)}
        title="Reservations coming soon"
        body="Book a table from Mesita shortly — for now, use Contact to reach the place."
        icon={CalendarCheck}
      />
      <ComingSoonModal
        open={soonKind === 'share'}
        onClose={() => setSoonKind(null)}
        title="Sharing coming soon"
        body="You'll be able to share this place with friends from here soon."
        icon={Share2}
      />
    </>
  );
}

function ActionBtn({
  label,
  onPress,
  Icon,
  saved,
  filled,
}: {
  label: string;
  onPress: () => void;
  Icon: LucideIcon;
  saved?: boolean;
  filled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-11 flex-1 flex-row items-center justify-center gap-1 rounded-xl border ${
        saved
          ? 'border-red-500/50 bg-red-500/12'
          : 'border-border bg-card active:bg-muted'
      }`}
    >
      <Icon
        color={saved ? '#dc2626' : '#260409'}
        size={15}
        fill={filled ? '#dc2626' : 'transparent'}
        strokeWidth={2.25}
      />
      <Text
        className={`text-[13px] font-semibold ${
          saved ? 'text-red-600' : 'text-foreground'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
