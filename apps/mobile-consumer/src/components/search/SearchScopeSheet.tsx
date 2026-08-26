import { MapPin, X } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SHADOW_ELEV } from '@/constants/brand';
import {
  SEARCH_COUNTRIES,
  countryLabel,
} from '@/lib/search-scope';

export function SearchScopeSheet({
  open,
  country,
  locationSet,
  locating,
  onCountry,
  onUseLocation,
  onClearLocation,
  onClose,
}: {
  open: boolean;
  country: string | null;
  locationSet: boolean;
  locating: boolean;
  onCountry: (code: string | null) => void;
  onUseLocation: () => void;
  onClearLocation: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl border border-border bg-card"
          style={{ paddingBottom: Math.max(insets.bottom, 16), ...SHADOW_ELEV }}
          accessibilityViewIsModal
          accessibilityLabel="Place search"
        >
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
            <Text className="text-base font-semibold text-foreground">
              Place search
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full"
            >
              <X color={COLORS.mutedForeground} size={16} />
            </Pressable>
          </View>

          <View className="gap-3 border-t border-border px-5 py-4">
            <View>
              <Text className="text-sm font-semibold text-foreground">
                Location
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                Centers the map and biases name search. Optional.
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <MapPin color={COLORS.primary} size={16} />
              <Text className="flex-1 text-sm text-foreground">
                {locationSet
                  ? 'Using your current location'
                  : 'Not set — the map stays on Monterrey and search is not biased'}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={onUseLocation}
                disabled={locating}
                accessibilityRole="button"
                accessibilityLabel="Use my location"
                className="rounded-full bg-primary px-3 py-2"
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: COLORS.primaryForeground }}
                >
                  {locating ? 'Locating…' : 'Use my location'}
                </Text>
              </Pressable>
              <Pressable
                onPress={onClearLocation}
                disabled={!locationSet}
                accessibilityRole="button"
                accessibilityLabel="Clear location"
                className="rounded-full border border-border px-3 py-2"
              >
                <Text className="text-xs font-semibold text-foreground">
                  Clear
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="gap-3 border-t border-border px-5 py-4">
            <View>
              <Text className="text-sm font-semibold text-foreground">
                Country
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                Limits Google Autocomplete and Text Search. Optional.
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              <Pressable
                onPress={() => onCountry(null)}
                accessibilityRole="button"
                accessibilityLabel="Any country"
                className={
                  country == null
                    ? 'rounded-full border border-primary bg-primary/10 px-2.5 py-1'
                    : 'rounded-full border border-border px-2.5 py-1'
                }
              >
                <Text
                  className={
                    country == null
                      ? 'text-xs font-semibold text-primary'
                      : 'text-xs font-semibold text-muted-foreground'
                  }
                >
                  Any
                </Text>
              </Pressable>
              {SEARCH_COUNTRIES.map((item) => {
                const active = country === item.code;
                return (
                  <Pressable
                    key={item.code}
                    onPress={() => onCountry(item.code)}
                    accessibilityRole="button"
                    accessibilityLabel={countryLabel(item.code)}
                    className={
                      active
                        ? 'rounded-full border border-primary bg-primary/10 px-2.5 py-1'
                        : 'rounded-full border border-border px-2.5 py-1'
                    }
                  >
                    <Text
                      className={
                        active
                          ? 'text-xs font-semibold text-primary'
                          : 'text-xs font-semibold text-muted-foreground'
                      }
                    >
                      {item.code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
