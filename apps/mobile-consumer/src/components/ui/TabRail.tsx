import { type Href, useRouter } from 'expo-router';
import {
  Flame,
  Heart,
  MapPin,
  QrCode,
  Search,
  Sparkles,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShellWash } from '@/components/ui/HeroBackdrop';
import { SegmentNav, type SegmentItem } from '@/components/ui/SegmentNav';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';

// The top rail of a bottom tab — RN port of web ModeRail (Pato, MESITA-2050:
// "Visit. Order. Wallet. Me. · Home(scroll). Search. Chat. Favs. Pay. · Order
// must have Home.").
//
//   Visit   Home · Search · Chat · Favs · Pay
//   Order   Home
//
// EVERY PILL IS ITS OWN (tabs) SCREEN, hidden from the bar. Web draws one rail
// over five URLs with a route group; here the rail navigates between sibling
// tab routes, which keeps each pill mounted — the map, the deck and a Memo
// thread all survive a round trip through another pill. ConsumerTabBar lights
// Visit for all five.
//
// Five content-width pills scroll a little at rest on a 375pt phone — the
// accepted SegmentNav behaviour (this package's CLAUDE.md). Never shrink the
// type below 12px to avoid it.
//
// Order's row is ONE pill, on purpose: Pato asked for Home there, and the row
// makes Order the same kind of tab as Visit. The next Order mode is an append.
type RailItem = SegmentItem & { href: string };

export const VISIT_RAIL: readonly RailItem[] = [
  { key: 'home', title: 'Home', Icon: Flame, href: CONSUMER_ROUTES.discoverTabs.scroll },
  { key: 'search', title: 'Search', Icon: Search, href: CONSUMER_ROUTES.search },
  { key: 'chat', title: 'Chat', Icon: Sparkles, href: CONSUMER_ROUTES.discoverTabs.chat },
  { key: 'favs', title: 'Favs', Icon: Heart, href: CONSUMER_ROUTES.discoverTabs.favs },
  { key: 'pay', title: 'Pay', Icon: QrCode, href: CONSUMER_ROUTES.rewards.root },
];

export const ORDER_RAIL: readonly RailItem[] = [
  { key: 'home', title: 'Home', Icon: MapPin, href: CONSUMER_ROUTES.order.home },
];

export function TabRail({
  items,
  value,
}: {
  items: readonly RailItem[];
  value: string;
}) {
  const router = useRouter();
  return (
    <View
      className="border-b border-border bg-background/90"
      style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 }}
    >
      <SegmentNav
        items={items}
        value={value}
        onChange={(key) => {
          const item = items.find((i) => i.key === key);
          // navigate, not push: the pills are siblings in one tab navigator,
          // so this focuses the existing screen instead of stacking a copy.
          if (item && key !== value) router.navigate(item.href as Href);
        }}
      />
    </View>
  );
}

/** A tab screen with a rail: the shell wash, the top safe area, the rail, then
 *  a flex body. Every Visit pill and Order's Home render through this. */
export function TabFrame({
  items,
  value,
  children,
}: {
  items: readonly RailItem[];
  value: string;
  children: ReactNode;
}) {
  return (
    <ShellWash>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <TabRail items={items} value={value} />
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      </SafeAreaView>
    </ShellWash>
  );
}
