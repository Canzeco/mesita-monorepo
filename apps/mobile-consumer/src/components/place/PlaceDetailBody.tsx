import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AboutBox } from '@/components/place/AboutBox';
import { ProductsTab } from '@/components/place/ProductsTab';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { HoursBox, LocationBox, MediaBox } from './place-detail/hours-location';
import { LinksBox } from './place-detail/links';
import { LastUpdatedBox, TagsBox, VerificationBox } from './place-detail/meta';
import { ProfileSummary } from './place-detail/profile';
import { GoogleReviewsBox, MesitaReviewsBox, ReviewsSummaryBox } from './place-detail/reviews';
import { RewardsBox } from './place-detail/rewards';

type PlaceTab = 'place' | 'reviews' | 'products' | 'rewards';

const PLACE_TABS: { key: PlaceTab; label: string }[] = [
  { key: 'place', label: 'Place' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'products', label: 'Products' },
  { key: 'rewards', label: 'Rewards' },
];

// Owns the scroll container so the tab strip can pin. The three direct
// children below map to fixed stickyHeaderIndices — [1] is the tab strip —
// mirroring web's `sticky top-0` PlaceTabBar (see web PlaceDetailBody /
// tabs.tsx). Keep them as three literal children (no fragments) so the
// index math stays deterministic.
export function PlaceDetailBody({
  place,
  onSaveToggle,
}: {
  place: PlaceDetail;
  onSaveToggle?: (saved: boolean) => void;
}) {
  const [tab, setTab] = useState<PlaceTab>('place');
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="pb-10"
      stickyHeaderIndices={[1]}
      showsVerticalScrollIndicator={false}
    >
      {/* 0 — profile summary band (scrolls away under the strip) */}
      <ProfileSummary place={place} onSaveToggle={onSaveToggle} />

      {/* 1 — sticky tab strip: stays reachable while deep in a tab */}
      <PlaceTabBar tab={tab} onChange={setTab} />

      {/* 2 — active tab content */}
      <View className="gap-3 px-4 pt-3">
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
    </ScrollView>
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
    // Solid bg-background (opaque) so scrolled-out content can't bleed
    // through while the strip is pinned to the top of the scroll area.
    <View className="flex-row border-b border-border bg-background px-2">
      {PLACE_TABS.map((t) => {
        const active = t.key === tab;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.label}
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
