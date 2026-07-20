import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoveryFilters } from '@/components/discovery/DiscoveryFilters';
import type { CategoryOption } from '@/lib/discovery-filters-engine';

// Discovery filters (MESITA-646/650, five-parameter rebuild MESITA-672): the
// shared sheet — Where · Distance · When · What · Randomness — opened from the
// Filter button in the swipe action bar and from the Search bar's tune icon.
// RN bottom-sheet Modal matching web LocalSheet. Filter state lives in the
// global use-discovery-filters store — not in the sheet.

export function FilterSheet({
  open,
  onClose,
  ariaLabel = 'Discovery filters',
  categoryOptions,
  count,
  hasLocation,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  categoryOptions: CategoryOption[];
  count: number;
  hasLocation: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityLabel={ariaLabel}
    >
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View
          className="max-h-[92%] rounded-t-3xl border-t border-border bg-card"
          style={{ paddingBottom: Math.max(insets.bottom, 8) }}
          accessibilityViewIsModal
          accessibilityLabel={ariaLabel}
        >
          <View className="min-h-[420px]" style={{ maxHeight: '100%' }}>
            <DiscoveryFilters
              onClose={onClose}
              categoryOptions={categoryOptions}
              count={count}
              hasLocation={hasLocation}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
