import { Redirect } from 'expo-router';

import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';

// Legacy web `/pay` → Rewards tab (live via deep link; tab tap stays soon).
export default function PayRedirect() {
  return <Redirect href={CONSUMER_ROUTES.rewards.root} />;
}
