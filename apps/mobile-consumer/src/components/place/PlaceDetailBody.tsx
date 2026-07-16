import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BadgeCheck,
  Bike,
  CalendarCheck,
  Camera,
  ChevronRight,
  CircleHelp,
  Clock,
  Crown,
  Gift,
  Globe,
  Heart,
  Link2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  QrCode,
  Share2,
  Sparkles,
  SquareArrowOutUpRight,
  Star,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { MesitaMark } from '@/components/brand/MesitaMark';
import { AboutBox } from '@/components/place/AboutBox';
import { ComingSoonModal } from '@/components/ui/ComingSoonModal';
import { ImageCarousel } from '@/components/place/ImageCarousel';
import { PlaceContactSheet } from '@/components/place/PlaceContactSheet';
import { ProductsTab } from '@/components/place/ProductsTab';
import { ReviewCard } from '@/components/place/ReviewCard';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';
import { formatPlacePriceChip } from '@/lib/place-price';
import {
  placeOffersMesitaRewards,
  resolveActivePromoRate,
  resolvePromoRateFromPlaceRow,
} from '@/lib/promo-rates';
import { useSavedPlaces } from '@/lib/saved-places';
import type {
  ConsumerClassKey,
  PlaceDetail,
} from '@/lib/types/place-detail';
import { buildUberDropoffUrl } from '@/lib/uber-link';
import {
  firstInitial,
  formatCompactCount,
  formatRating,
} from '@/lib/utils';
import { useAuth } from '@/providers/auth';
import {
  CHANNEL_CLAY,
  CHANNEL_DEFS,
  FACET_TINT,
  RESERVATION_DEFS,
} from './place-detail-links';

type PlaceTab = 'place' | 'reviews' | 'products' | 'rewards';

const PLACE_TABS: { key: PlaceTab; label: string }[] = [
  { key: 'place', label: 'Place' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'products', label: 'Products' },
  { key: 'rewards', label: 'Rewards' },
];

export function PlaceDetailBody({
  place,
  onSaveToggle,
}: {
  place: PlaceDetail;
  onSaveToggle?: (saved: boolean) => void;
}) {
  const [tab, setTab] = useState<PlaceTab>('place');
  return (
    <View className="pb-4">
      <ProfileSummary place={place} onSaveToggle={onSaveToggle} />
      <View className="gap-3 px-4">
        <PlaceTabBar tab={tab} onChange={setTab} />
        {tab === 'place' ? (
          <>
            <MediaBox place={place} />
            <LocationBox place={place} />
            <HoursBox place={place} />
            <LinksBox place={place} />
            <AboutBox text={place.long_description} name={place.name} />
            <TagsBox place={place} />
            <VerificationBox place={place} />
            <LastUpdatedBox place={place} />
          </>
        ) : null}
        {tab === 'reviews' ? (
          <>
            <ReviewsSummaryBox place={place} />
            <GoogleReviewsBox place={place} />
            <MesitaReviewsBox place={place} />
          </>
        ) : null}
        {tab === 'products' ? <ProductsTab menus={place.menus} /> : null}
        {tab === 'rewards' ? <RewardsBox place={place} /> : null}
      </View>
    </View>
  );
}

function PlaceTabBar({
  tab,
  onChange,
}: {
  tab: PlaceTab;
  onChange: (t: PlaceTab) => void;
}) {
  return (
    <View className="-mx-4 flex-row border-b border-border bg-background px-2">
      {PLACE_TABS.map((t) => {
        const active = t.key === tab;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            className={`flex-1 items-center border-b-2 py-3 ${
              active ? 'border-pink-500' : 'border-transparent'
            }`}
          >
            <Text
              className={`text-[13px] font-semibold tracking-wide ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Box({
  title,
  icon: Icon,
  iconColor = '#775254',
  right,
  children,
  bare = false,
}: {
  title?: string;
  icon?: LucideIcon;
  iconColor?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <View
      className={`rounded-2xl border border-border bg-card ${
        bare ? 'overflow-hidden' : 'gap-3 p-4'
      }`}
    >
      {(title || Icon) && !bare ? (
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            {Icon ? <Icon color={iconColor} size={16} strokeWidth={1.75} /> : null}
            {title ? <BoxLabel>{title}</BoxLabel> : null}
          </View>
          {right ? (
            <Text className="shrink text-right text-xs font-medium text-muted-foreground">
              {right}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function BoxLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </Text>
  );
}

function ProfileSummary({
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

function ProfileMetaChip({ children }: { children: React.ReactNode }) {
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

function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || km <= 0) return '- km';
  return `${km} km`;
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

function MediaBox({ place }: { place: PlaceDetail }) {
  if (place.photos.length === 0) return null;
  return (
    <Box bare>
      <ImageCarousel photos={place.photos} alt={place.name} />
    </Box>
  );
}

function ReviewsSummaryBox({ place }: { place: PlaceDetail }) {
  const hasReviews = place.mesita_reviews.total > 0;
  const overall = hasReviews ? place.mesita_reviews.overall : 5.0;
  const subRatings: [string, number][] = [
    ['Food', hasReviews ? place.mesita_reviews.food : 5.0],
    ['Service', hasReviews ? place.mesita_reviews.service : 5.0],
    ['Ambience', hasReviews ? place.mesita_reviews.ambiance : 5.0],
    ['Value', hasReviews ? place.mesita_reviews.value : 5.0],
  ];
  return (
    <Box title="Reviews summary" icon={Star} iconColor="#a78bfa">
      <View className="gap-4 rounded-xl bg-background p-4">
        <View className="flex-row items-center gap-2">
          <MesitaMark size={18} />
          <Text className="text-sm font-semibold text-foreground">Mesita</Text>
          <Text className="ml-auto text-[11px] text-muted-foreground">
            {place.mesita_reviews.total} reviews
          </Text>
        </View>
        <View className="flex-row items-center gap-4">
          <View className="h-20 w-20 items-center justify-center gap-1 rounded-2xl bg-pink-500/10">
            <View className="flex-row items-baseline gap-1">
              <Text className="font-display text-2xl font-semibold text-foreground">
                {formatRating(overall)}
              </Text>
              <Star color="#fbbf24" fill="#fbbf24" size={12} />
            </View>
            <Text className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
              Overall
            </Text>
          </View>
          <View className="flex-1 gap-2">
            {subRatings.map(([label, value]) => (
              <RatingBar key={label} label={label} value={value} />
            ))}
          </View>
        </View>
      </View>
      <View className="flex-row gap-2">
        <ExternalCard
          label="Google"
          icon="star"
          value={formatRating(place.google.rating) ?? '—'}
          meta={`${formatCompactCount(place.google.count, true)} reviews`}
        />
        <ExternalCard
          label="IG"
          icon="users"
          value={formatCompactCount(place.instagram.followers, false)}
          meta="followers"
        />
        <ExternalCard
          label="FB"
          icon="users"
          value={formatCompactCount(place.facebook.followers, false)}
          meta="followers"
        />
      </View>
    </Box>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <View className="flex-row items-center gap-2">
      <Text className="w-14 text-[11px] text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{ height: '100%', width: `${pct}%`, borderRadius: 999 }}
        />
      </View>
      <Text className="w-8 text-right text-[11px] font-semibold tabular-nums text-foreground">
        {formatRating(value)}
      </Text>
    </View>
  );
}

function ExternalCard({
  label,
  icon,
  value,
  meta,
}: {
  label: string;
  icon: 'star' | 'users';
  value: string;
  meta: string;
}) {
  return (
    <View className="flex-1 items-center gap-1.5 rounded-xl bg-background px-2 py-3">
      <Text className="mb-1 text-[10px] font-bold text-muted-foreground">
        {label}
      </Text>
      <View className="flex-row items-center gap-1">
        {icon === 'star' ? (
          <Star color="#fbbf24" fill="#fbbf24" size={14} />
        ) : (
          <Users color="#775254" size={14} />
        )}
        <Text className="text-sm font-semibold text-foreground">{value}</Text>
      </View>
      <Text className="text-[10px] leading-tight text-muted-foreground">
        {meta}
      </Text>
    </View>
  );
}

type ReviewSort = 'newest' | 'highest' | 'lowest';

function ReviewSortChips({
  sort,
  onSort,
  label,
}: {
  sort: ReviewSort;
  onSort: (next: ReviewSort) => void;
  label: string;
}) {
  const modes: { key: ReviewSort; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'highest', label: 'Highest' },
    { key: 'lowest', label: 'Lowest' },
  ];
  return (
    <View
      className="flex-row gap-1 rounded-xl bg-muted/60 p-1"
      accessibilityLabel={label}
    >
      {modes.map((mode) => (
        <Pressable
          key={mode.key}
          onPress={() => onSort(mode.key)}
          className={`flex-1 items-center rounded-lg py-1.5 ${
            sort === mode.key ? 'bg-card' : ''
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              sort === mode.key ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {mode.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function reviewTimeMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

function GoogleReviewsBox({ place }: { place: PlaceDetail }) {
  const [sort, setSort] = useState<ReviewSort>('newest');
  const reviews = place.google_reviews;
  const sorted = useMemo(() => {
    const copy = [...reviews];
    copy.sort((a, b) => {
      if (sort === 'highest') {
        return (
          b.rating - a.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date)
        );
      }
      if (sort === 'lowest') {
        return (
          a.rating - b.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date)
        );
      }
      return reviewTimeMs(b.date) - reviewTimeMs(a.date);
    });
    return copy;
  }, [reviews, sort]);

  if (reviews.length === 0) return null;
  return (
    <Box
      title="Google reviews"
      icon={Star}
      iconColor="#fbbf24"
      right={`${formatCompactCount(place.google.count, true)} total`}
    >
      <ReviewSortChips
        sort={sort}
        onSort={setSort}
        label="Sort Google reviews"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3">
          {sorted.map((data, i) => (
            <ReviewCard
              key={`google-${data.author}-${data.date}-${i}`}
              kind="google"
              data={data}
            />
          ))}
        </View>
      </ScrollView>
    </Box>
  );
}

function mesitaOverall(v: PlaceDetail['mesita_visitors'][number]): number {
  return (v.food + v.service + v.ambiance + v.value) / 4;
}

function MesitaReviewsBox({ place }: { place: PlaceDetail }) {
  const [sort, setSort] = useState<ReviewSort>('newest');
  const visitors = place.mesita_visitors;
  const sorted = useMemo(() => {
    if (sort === 'newest') return visitors;
    const copy = [...visitors];
    copy.sort((a, b) => {
      const diff = mesitaOverall(b) - mesitaOverall(a);
      return sort === 'highest' ? diff : -diff;
    });
    return copy;
  }, [visitors, sort]);

  if (visitors.length === 0) {
    return (
      <Box
        title="Mesita reviews"
        icon={MessageCircle}
        iconColor="#f472b6"
        right={`${place.mesita_reviews.total} total`}
      >
        <View className="items-center gap-3 py-3">
          <View className="size-12 items-center justify-center rounded-full bg-muted">
            <MessageCircle color="#775254" size={20} />
          </View>
          <Text className="text-sm font-semibold text-foreground">
            No Mesita reviews yet
          </Text>
          <Text className="text-center text-xs leading-snug text-muted-foreground">
            Be the first guest to leave a review after visiting.
          </Text>
        </View>
      </Box>
    );
  }
  return (
    <Box
      title="Mesita reviews"
      icon={MessageCircle}
      iconColor="#f472b6"
      right={`${place.mesita_reviews.total} total`}
    >
      <ReviewSortChips
        sort={sort}
        onSort={setSort}
        label="Sort Mesita reviews"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3">
          {sorted.map((data, i) => (
            <ReviewCard
              key={`mesita-${data.handle}-${i}`}
              kind="mesita"
              data={data}
            />
          ))}
        </View>
      </ScrollView>
    </Box>
  );
}

function LocationBox({ place }: { place: PlaceDetail }) {
  const mapsUrl =
    place.reviews_maps.google_maps_url ??
    `https://maps.google.com/?q=${encodeURIComponent(place.address)}`;
  const uberUrl = buildUberDropoffUrl(place);
  return (
    <Box
      title="Location"
      icon={MapPin}
      iconColor="#ec4899"
      right={formatDistanceKm(place.distance_km)}
    >
      <View
        className="aspect-[2/1] items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: '#1d1442' }}
      >
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            ...SHADOW_GLOW,
          }}
        >
          <MapPin color="#fff" fill="#fff" size={16} strokeWidth={1.5} />
        </LinearGradient>
        <View className="mt-1.5 max-w-[90%] rounded-full bg-black/80 px-2.5 py-0.5">
          <Text className="text-[11px] font-medium text-white" numberOfLines={1}>
            {place.name}
          </Text>
        </View>
      </View>
      <Text className="text-xs leading-snug text-muted-foreground">
        {place.address}
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => void Linking.openURL(mapsUrl)}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-amber-200/70 bg-amber-50 px-3 py-2.5"
        >
          <MapPin color="#78350f" size={14} />
          <Text className="text-xs font-semibold text-amber-950">
            Google Maps
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL(uberUrl)}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-zinc-300/70 bg-zinc-100 px-3 py-2.5"
        >
          <Bike color="#18181b" size={14} />
          <Text className="text-xs font-semibold text-zinc-900">Ask Uber</Text>
        </Pressable>
      </View>
    </Box>
  );
}

function todayWeekdayLabel(tz: string | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC',
      weekday: 'long',
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(
      new Date(),
    );
  }
}

function HoursBox({ place }: { place: PlaceDetail }) {
  const today = todayWeekdayLabel(place.timezone);
  const statusDetail = place.open_now
    ? place.closes_at
      ? `until ${place.closes_at}`
      : null
    : place.opens_at
      ? `opens ${place.opens_at}`
      : null;
  const tz = place.timezone || undefined;

  return (
    <Box title="Time" icon={Clock} iconColor="#a78bfa" right={tz}>
      <Text className="text-xs leading-snug">
        <Text
          className={`font-semibold ${
            place.open_now ? 'text-emerald-700' : 'text-muted-foreground'
          }`}
        >
          {place.open_now ? 'Open' : 'Closed'}
        </Text>
        {statusDetail ? (
          <Text className="text-foreground/80"> · {statusDetail}</Text>
        ) : null}
      </Text>
      {place.hours_table.length > 0 ? (
        <View className="overflow-hidden rounded-xl border border-border">
          {place.hours_table.map((row) => {
            const isToday = row.day === today;
            const closed = row.range.toLowerCase() === 'closed';
            return (
              <View
                key={row.day}
                className={`flex-row items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 last:border-b-0 ${
                  isToday ? 'bg-violet-50/80' : ''
                }`}
              >
                <Text
                  className={`shrink-0 text-xs font-semibold ${
                    isToday ? 'text-violet-800' : 'text-foreground'
                  }`}
                >
                  {row.day}
                </Text>
                <Text
                  className={`min-w-0 flex-1 text-right text-xs tabular-nums ${
                    closed
                      ? 'text-muted-foreground'
                      : isToday
                        ? 'font-semibold text-violet-950'
                        : 'text-foreground/85'
                  }`}
                  numberOfLines={1}
                >
                  {row.range}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Box>
  );
}

function RewardsBox({ place }: { place: PlaceDetail }) {
  const router = useRouter();
  const { consumerClass } = useAuth();
  const classKey: ConsumerClassKey =
    consumerClass?.class === 'premium' ? 'premium' : 'free';
  const { welcome, default: returning, is_first_visit } = place.promo_matrix;
  const offersRewards = placeOffersMesitaRewards({
    listing_type: place.listing_type,
    promo_matrix: place.promo_matrix,
    promo_configured: place.promo_configured === true,
  });
  const isPartner = place.listing_type === 'partner';

  if (!offersRewards) {
    return (
      <Box title="Reward" icon={Sparkles} iconColor="#f472b6">
        <View className="items-center gap-3 py-3">
          <View className="size-12 items-center justify-center rounded-full bg-muted">
            <Gift color="#775254" size={20} />
          </View>
          <Text className="text-sm font-semibold text-foreground">
            {"This place doesn't offer rewards"}
          </Text>
          <Text className="text-center text-xs leading-snug text-muted-foreground">
            {isPartner
              ? "This Verified Partner isn't running a Mesita reward right now."
              : place.promo_configured
                ? 'Rewards are being set up for this place.'
                : 'Only Verified Partners run the Mesita reward program — this place is a web listing.'}
          </Text>
        </View>
      </Box>
    );
  }

  const activeValue = resolveActivePromoRate(
    place.promo_matrix,
    classKey,
    is_first_visit,
  );
  const mechanicWord = place.details.mechanic.toLowerCase();
  const capLabel =
    place.reward_cap_mxn != null && place.reward_cap_mxn > 0
      ? `MX$${place.reward_cap_mxn.toLocaleString('en-US')}`
      : null;
  const visitLabel = is_first_visit ? 'First visit' : 'Returning visit';
  const subtitle =
    activeValue == null
      ? `No reward at Mesita ${classKey === 'premium' ? 'Premium' : 'Free'} yet`
      : capLabel
        ? `${visitLabel} · on your first ${capLabel}`
        : visitLabel;
  const isFree = classKey === 'free';
  const isPremiumViaInstagram =
    !isFree && consumerClass?.origin === 'instagram';

  return (
    <Box title="Reward" icon={Sparkles} iconColor="#f472b6">
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{ borderRadius: 12, padding: 16, ...SHADOW_GLOW }}
      >
        <Text className="font-display text-3xl font-semibold leading-none text-white">
          {activeValue == null ? '—' : `${activeValue}% ${mechanicWord}`}
        </Text>
        <Text className="mt-1.5 text-xs leading-snug text-white/90">
          {subtitle}
        </Text>
      </LinearGradient>

      <View className="gap-3">
        <BoxLabel>How it works</BoxLabel>
        <RewardStep
          n={1}
          icon={QrCode}
          title="Pay with your QR"
          body="Pay your bill and show your Mesita QR — the waiter scans it to start your reward."
        />
        <RewardStep
          n={2}
          icon={Camera}
          title="Post a story — Premium via Instagram only"
          body="If your Premium comes from Instagram, post a story tagging the place right after the waiter scans your QR. Free and paid-Premium guests skip this step."
          accent
        />
        <RewardStep
          n={3}
          icon={Sparkles}
          title={`Get your ${mechanicWord}`}
          body={`Your ${mechanicWord} is applied automatically${
            capLabel ? ` — on the first ${capLabel} of your bill` : ''
          }.`}
        />
      </View>

      <RewardMatrix
        welcome={welcome}
        returning={returning}
        currentClass={classKey}
        isFirstVisit={is_first_visit}
      />

      <View className="gap-2">
        {isFree ? (
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => router.push('/(tabs)/rewards')}
              className="flex-1 overflow-hidden rounded-lg"
            >
              <LinearGradient
                colors={[...GRADIENTS.pink]}
                start={GRADIENT_DIAGONAL.start}
                end={GRADIENT_DIAGONAL.end}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                }}
              >
                <QrCode color="#fff" size={16} />
                <Text className="text-sm font-semibold text-white">
                  Pay with QR
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/me')}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <Crown color="#260409" size={16} />
              <Text className="text-sm font-semibold text-foreground">
                Upgrade plan
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/(tabs)/rewards')}
            className="overflow-hidden rounded-lg"
          >
            <LinearGradient
              colors={[...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
            >
              <QrCode color="#fff" size={16} />
              <Text className="text-sm font-semibold text-white">
                {isPremiumViaInstagram
                  ? 'Pay with QR & post IG story'
                  : 'Pay with QR to claim reward'}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
        <Text className="text-center text-[11px] leading-snug text-muted-foreground">
          {isFree
            ? 'Pay with your QR to claim your reward — or upgrade to Premium for a bigger one.'
            : isPremiumViaInstagram
              ? 'Pay with your QR, then post an Instagram story to unlock your Premium reward.'
              : 'Just pay with your QR — your Premium reward applies automatically.'}
        </Text>
      </View>
    </Box>
  );
}

function RewardStep({
  n,
  icon: Icon,
  title,
  body,
  accent,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <View className="flex-row gap-3">
      <View
        className={`relative mt-0.5 size-7 items-center justify-center rounded-full ${
          accent ? 'bg-violet-500/10' : 'bg-pink-500/10'
        }`}
      >
        <Icon color={accent ? '#8b6ce8' : '#fb2b7b'} size={14} strokeWidth={2} />
        <View className="absolute -top-1 -right-1 size-4 items-center justify-center rounded-full bg-foreground">
          <Text className="text-[9px] font-bold text-background">{n}</Text>
        </View>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-semibold leading-tight text-foreground">
          {title}
        </Text>
        <Text className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          {body}
        </Text>
      </View>
    </View>
  );
}

function RewardMatrix({
  welcome,
  returning,
  currentClass,
  isFirstVisit,
}: {
  welcome: { free: number | null; premium: number | null };
  returning: { free: number | null; premium: number | null };
  currentClass: ConsumerClassKey;
  isFirstVisit: boolean;
}) {
  const rows = [
    { key: 'first', label: 'First visit', vals: welcome, onAxis: isFirstVisit },
    {
      key: 'returning',
      label: 'Returning',
      vals: returning,
      onAxis: !isFirstVisit,
    },
  ] as const;
  return (
    <View className="overflow-hidden rounded-xl border border-border">
      <View className="flex-row items-center px-3 py-2.5">
        <View className="flex-1" />
        <Text className="flex-1 text-center font-display text-[13px] font-bold">
          Free
        </Text>
        <View className="flex-1 flex-row items-center justify-center gap-1">
          <Crown color="#8b6ce8" size={12} fill="#8b6ce8" />
          <Text className="font-display text-[13px] font-bold text-[#8b6ce8]">
            Premium
          </Text>
        </View>
      </View>
      {rows.map((r, i) => (
        <View
          key={r.key}
          className={`flex-row items-center px-3 py-3 ${
            i > 0 ? 'border-t border-border/40' : ''
          }`}
        >
          <Text className="flex-1 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {r.label}
          </Text>
          <View className="flex-1 items-center">
            <RewardCell
              value={r.vals.free}
              active={r.onAxis && currentClass === 'free'}
            />
          </View>
          <View className="flex-1 items-center">
            <RewardCell
              value={r.vals.premium}
              accent
              active={r.onAxis && currentClass === 'premium'}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function RewardCell({
  value,
  accent,
  active,
}: {
  value: number | null;
  accent?: boolean;
  active?: boolean;
}) {
  const text = value == null ? '—' : `${value}%`;
  if (active) {
    return (
      <View className="relative">
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 12,
            paddingRight: 20,
            ...SHADOW_GLOW,
          }}
        >
          <Text className="font-display text-[15px] font-bold text-white">
            {text}
            {value != null ? (
              <Text className="text-[10px] text-white/85"> off</Text>
            ) : null}
          </Text>
        </LinearGradient>
        <Text className="absolute top-0.5 right-1.5 text-[7px] font-bold tracking-[0.1em] text-white/85 uppercase">
          Now
        </Text>
      </View>
    );
  }
  return (
    <Text
      className={`font-display text-[15px] font-bold ${
        accent ? 'text-violet-500' : 'text-foreground/80'
      }`}
    >
      {text}
      {value != null ? (
        <Text
          className={`text-[10px] ${
            accent ? 'text-violet-400' : 'text-muted-foreground'
          }`}
        >
          {' '}
          off
        </Text>
      ) : null}
    </Text>
  );
}

function TagsBox({ place }: { place: PlaceDetail }) {
  if (place.tags.length === 0) return null;
  return (
    <Box title="Tags" icon={Tags} iconColor="#f472b6">
      <View className="flex-row flex-wrap gap-2">
        {place.tags.map((t) => {
          const tint = FACET_TINT[t.facet] ?? {
            bg: '#f8fafc',
            text: '#334155',
            border: '#e2e8f0',
            dot: '#94a3b8',
          };
          return (
            <View
              key={t.slug}
              className="flex-row items-center gap-1.5 rounded-full border px-3 py-1.5"
              style={{
                backgroundColor: tint.bg,
                borderColor: tint.border,
              }}
            >
              <View
                className="size-1.5 rounded-full"
                style={{ backgroundColor: tint.dot }}
              />
              <Text
                className="text-xs font-semibold"
                style={{ color: tint.text }}
              >
                {t.label}
              </Text>
            </View>
          );
        })}
      </View>
    </Box>
  );
}

function VerificationBox({ place }: { place: PlaceDetail }) {
  const isPartner = place.listing_type === 'partner';
  return (
    <Box
      title="Verification"
      icon={isPartner ? BadgeCheck : CircleHelp}
      iconColor={isPartner ? '#0ea5e9' : '#94a3b8'}
    >
      {isPartner ? (
        <Text className="text-xs leading-relaxed text-muted-foreground">
          <Text className="font-semibold text-foreground">Verified Partner. </Text>
          This business signed up on Mesita, confirmed ownership, and can run
          rewards and take reservations through the app.
        </Text>
      ) : (
        <>
          <Text className="text-xs leading-relaxed text-muted-foreground">
            <Text className="font-semibold text-foreground">Not verified. </Text>
            {
              "This is a web listing Mesita found online. Details may be incomplete, and the place can't offer Mesita rewards until an owner claims it. Claiming ownership is completely free."
            }
          </Text>
          <Pressable
            onPress={() => void Linking.openURL('https://business.mesita.ai/add')}
            className="mt-1 flex-row items-center gap-1.5 self-start rounded-full bg-slate-500/10 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-slate-700">
              {"Are you the owner? Claim ownership — it's free"}
            </Text>
            <ChevronRight color="#334155" size={14} />
          </Pressable>
        </>
      )}
    </Box>
  );
}

function LastUpdatedBox({ place }: { place: PlaceDetail }) {
  if (place.is_enriching || !place.last_updated_label) return null;
  return (
    <Box title="Last update" icon={Clock} iconColor="#94a3b8">
      <Text className="text-sm font-medium tracking-wide text-muted-foreground">
        Updated {place.last_updated_label}
      </Text>
    </Box>
  );
}

function LinksBox({ place }: { place: PlaceDetail }) {
  const chips: {
    key: string;
    label: string;
    Icon: LucideIcon;
    url: string;
  }[] = [];
  if (place.phone) {
    chips.push({
      key: 'phone',
      label: 'Phone',
      Icon: Phone,
      url: `tel:${place.phone.replace(/\s+/g, '')}`,
    });
  }
  for (const def of CHANNEL_DEFS) {
    const url = place.channels[def.key];
    if (url) chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
  }
  for (const def of RESERVATION_DEFS) {
    const url = place.reservations[def.key];
    if (url) chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
  }
  if (place.reviews_maps.google_maps_url) {
    chips.push({
      key: 'google_maps_url',
      label: 'Google Maps',
      Icon: MapPin,
      url: place.reviews_maps.google_maps_url,
    });
  }
  if (chips.length === 0) return null;

  return (
    <Box title="Channels" icon={Link2} iconColor="#22d3ee">
      <View className="flex-row flex-wrap gap-2">
        {chips.map(({ key, label, Icon, url }) => {
          const clay = CHANNEL_CLAY[key] ?? {
            bg: '#fff9fa',
            text: '#260409',
            border: '#faeff0',
          };
          const leavesApp = !url.startsWith('tel:');
          return (
            <Pressable
              key={key}
              onPress={() => void Linking.openURL(url)}
              className="flex-row items-center gap-1.5 rounded-full border px-3 py-2"
              style={{
                backgroundColor: clay.bg,
                borderColor: clay.border,
              }}
            >
              <Icon color={clay.text} size={14} />
              <Text className="text-xs font-semibold" style={{ color: clay.text }}>
                {label}
              </Text>
              {leavesApp ? (
                <SquareArrowOutUpRight color={clay.text} size={12} opacity={0.55} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Box>
  );
}
