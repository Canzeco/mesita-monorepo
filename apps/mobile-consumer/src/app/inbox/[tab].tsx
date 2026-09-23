import { type Href, Redirect, useLocalSearchParams } from 'expo-router';

import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';

// Legacy `/inbox/<section>` deep links, landing where web's redirect table
// sends them: credits → Wallet, orders → Order (MESITA-2050), everything else
// → Me. Activity's three sections are Me pages now, and web lands every other
// /inbox address on the hub rather than guessing a section — this does the
// same, so a stale push lands identically on both platforms.
export default function InboxLegacyTabScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const target =
    tab === 'credits'
      ? CONSUMER_ROUTES.wallet.root
      : tab === 'orders'
        ? CONSUMER_ROUTES.order.root
        : CONSUMER_ROUTES.me;
  return <Redirect href={target as Href} />;
}
