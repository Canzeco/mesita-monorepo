import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoveryFilters } from '@/components/discovery/DiscoveryFilters';
import { useFiltersHostContext } from '@/lib/filters-host-context';

// Body of the Expo Stack /filters modal. Host context is published by
// Swipe/Search; dismiss is always router.back().

export function FiltersRouteClient() {
  const router = useRouter();
  const host = useFiltersHostContext();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      <DiscoveryFilters
        onClose={() => router.back()}
        categoryOptions={host.categoryOptions}
        count={host.count}
        hasLocation={host.hasLocation}
      />
    </View>
  );
}
