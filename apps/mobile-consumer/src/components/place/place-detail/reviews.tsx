import { MessageCircle, Star } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { MesitaMark } from '@/components/brand/MesitaMark';
import { ReviewCard } from '@/components/place/ReviewCard';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { formatCompactCount, formatRating } from '@/lib/utils';
import {
  ExternalCard,
  mesitaOverall,
  RatingBar,
  type ReviewSort,
  ReviewSortChips,
  reviewTimeMs,
} from './review-ui';
import { Box } from './shared';

export function ReviewsSummaryBox({ place }: { place: PlaceDetail }) {
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

export function GoogleReviewsBox({ place }: { place: PlaceDetail }) {
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

export function MesitaReviewsBox({ place }: { place: PlaceDetail }) {
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
