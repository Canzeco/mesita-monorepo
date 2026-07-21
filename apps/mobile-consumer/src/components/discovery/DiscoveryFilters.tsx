import { Clock, SlidersHorizontal, X } from 'lucide-react-native';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  Pill,
  PillText,
  RangeSlider,
  SectionLabel,
} from '@/components/discovery/discovery-filter-controls';
import { DiscoveryZoneField } from '@/components/discovery/discovery-zone-field';
import { GRADIENTS, GRADIENT_DIAGONAL, SHADOW_GLOW } from '@/constants/brand';
import {
  DISTANCE_MAX_KM,
  DISTANCE_MIN_KM,
  RANDOMNESS_ENDPOINTS,
  RANDOMNESS_MAX,
  RANDOMNESS_MIN,
  WEEKDAY_LABELS,
  formatHourLabel,
  hasDiscoveryPredicates,
  type CategoryOption,
  type RandomnessLevel,
} from '@/lib/discovery-filters-engine';
import { PLACE_FAMILIES } from '@/lib/place-families';
import {
  resetDiscoveryFilters,
  setDiscoveryAsk,
  setDiscoveryMaxKm,
  setDiscoveryRandomness,
  setDiscoveryWhen,
  toggleDiscoveryCategory,
  toggleDiscoveryFamily,
  useDiscoveryFilters,
} from '@/lib/use-discovery-filters';

// Shared body of the discovery FilterSheet (Home Swipe + Search map) — FIVE
// PARAMETERS, IN PATO'S ORDER (MESITA-672). RN port of web DiscoveryFilters.tsx.

export function DiscoveryFilters({
  onClose,
  categoryOptions,
  count,
  hasLocation,
}: {
  onClose: () => void;
  categoryOptions: CategoryOption[];
  count: number;
  hasLocation: boolean;
}) {
  const filters = useDiscoveryFilters();
  const hasPredicates = hasDiscoveryPredicates(filters);
  const hasCenter = filters.zone !== null || hasLocation;
  const when = filters.when;

  const startAt = () => {
    const now = new Date();
    setDiscoveryWhen({ mode: 'at', day: now.getDay(), hour: now.getHours() });
  };

  const staleCategories = filters.categories.filter(
    (slug) => !categoryOptions.some((c) => c.slug === slug),
  );

  return (
    <View className="min-h-0 flex-1 flex-col">
      <View className="flex-row items-center justify-between px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <SlidersHorizontal color="#fb2b7b" size={16} />
          </View>
          <Text className="font-display text-lg font-semibold tracking-tight text-foreground">
            Filters
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={resetDiscoveryFilters}
            className="rounded-full px-3 py-1.5 active:bg-muted/60"
          >
            <Text className="text-xs font-medium text-muted-foreground">
              Reset
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            className="h-8 w-8 items-center justify-center rounded-full active:bg-muted/60"
          >
            <X color="#775254" size={16} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="min-h-0 flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <SectionLabel>Where</SectionLabel>
        <DiscoveryZoneField zone={filters.zone} hasLocation={hasLocation} />

        <SectionLabel className="mt-5">Distance</SectionLabel>
        {hasCenter ? (
          <>
            <View className="mb-1 flex-row items-center gap-3">
              <Pill
                active={filters.maxKm === null}
                onClick={() => setDiscoveryMaxKm(null)}
              >
                Any
              </Pill>
              <Text className="ml-auto font-display text-base font-semibold tabular-nums text-foreground">
                {filters.maxKm === null
                  ? 'Any distance'
                  : `within ${filters.maxKm} km`}
              </Text>
            </View>
            <RangeSlider
              className="mt-3"
              min={DISTANCE_MIN_KM}
              max={DISTANCE_MAX_KM}
              value={filters.maxKm ?? 10}
              dimmed={filters.maxKm === null}
              ariaLabel="Distance tolerance in kilometres"
              onChange={(km) => setDiscoveryMaxKm(km)}
            />
          </>
        ) : (
          <Text className="text-[11px] text-muted-foreground/70">
            Pick a location above or turn on device location to filter by
            distance.
          </Text>
        )}

        <SectionLabel className="mt-5">When</SectionLabel>
        <View className="flex-row flex-wrap gap-1.5">
          <Pill
            active={when.mode === 'now'}
            onClick={() => setDiscoveryWhen({ mode: 'now' })}
          >
            <Clock
              color={when.mode === 'now' ? '#fff' : '#775254'}
              size={14}
            />
            <PillText active={when.mode === 'now'}>Now</PillText>
          </Pill>
          <Pill
            active={when.mode === 'anytime'}
            onClick={() => setDiscoveryWhen({ mode: 'anytime' })}
          >
            Anytime
          </Pill>
          <Pill active={when.mode === 'at'} onClick={startAt}>
            Pick a time
          </Pill>
        </View>
        {when.mode === 'at' ? (
          <View className="mt-3">
            <View className="flex-row flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => (
                <Pill
                  key={label}
                  active={when.day === day}
                  onClick={() =>
                    setDiscoveryWhen({ mode: 'at', day, hour: when.hour })
                  }
                >
                  {label}
                </Pill>
              ))}
            </View>
            <View className="mt-3 flex-row items-center">
              <Text className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                Open at
              </Text>
              <Text className="ml-auto font-display text-base font-semibold tabular-nums text-foreground">
                {formatHourLabel(when.hour)}
              </Text>
            </View>
            <RangeSlider
              className="mt-3"
              min={0}
              max={23}
              value={when.hour}
              ariaLabel="Hour of day"
              onChange={(hour) =>
                setDiscoveryWhen({ mode: 'at', day: when.day, hour })
              }
            />
          </View>
        ) : null}

        <SectionLabel className="mt-5">What</SectionLabel>
        <View className="flex-row flex-wrap gap-1.5">
          {PLACE_FAMILIES.map((family) => (
            <Pill
              key={family.key}
              active={filters.familyKeys.includes(family.key)}
              onClick={() => toggleDiscoveryFamily(family.key)}
            >
              {family.emoji} {family.label}
            </Pill>
          ))}
        </View>
        {categoryOptions.length > 1 || staleCategories.length > 0 ? (
          <>
            <SectionLabel className="mt-3" sub>
              Categories
            </SectionLabel>
            <View className="flex-row flex-wrap gap-1.5">
              {categoryOptions.map((option) => (
                <Pill
                  key={option.slug}
                  active={filters.categories.includes(option.slug)}
                  onClick={() => toggleDiscoveryCategory(option.slug)}
                >
                  {option.label}
                </Pill>
              ))}
              {staleCategories.map((slug) => (
                <Pill
                  key={slug}
                  active
                  onClick={() => toggleDiscoveryCategory(slug)}
                >
                  {slug}
                </Pill>
              ))}
            </View>
          </>
        ) : null}

        <SectionLabel className="mt-5">That · the ask</SectionLabel>
        <TextInput
          value={filters.ask}
          maxLength={200}
          onChangeText={setDiscoveryAsk}
          placeholder='what are you craving? — "mezcal cocktails for a date"'
          placeholderTextColor="#77525466"
          accessibilityLabel="The ask — free text, shapes your lineup"
          className="w-full rounded-xl border border-border/70 bg-muted/40 px-3.5 py-2.5 text-sm text-foreground"
        />
        <Text className="mt-1.5 text-[11px] text-muted-foreground/70">
          Shapes your lineup once the engine reads it — doesn&apos;t narrow the
          list yet.
        </Text>

        <SectionLabel className="mt-5">Randomness</SectionLabel>
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-[11px] font-medium text-muted-foreground">
            {RANDOMNESS_ENDPOINTS.min}
          </Text>
          <Text className="font-display text-base font-semibold tabular-nums text-foreground">
            {filters.randomness}
          </Text>
          <Text className="text-[11px] font-medium text-muted-foreground">
            {RANDOMNESS_ENDPOINTS.max}
          </Text>
        </View>
        <RangeSlider
          min={RANDOMNESS_MIN}
          max={RANDOMNESS_MAX}
          value={filters.randomness}
          ariaLabel="Randomness level, 0 to 5"
          onChange={(n) => setDiscoveryRandomness(n as RandomnessLevel)}
        />
      </ScrollView>

      <View className="shrink-0 border-t border-border/60 p-4">
        {count > 0 ? (
          <Pressable
            onPress={onClose}
            className="h-12 w-full overflow-hidden rounded-xl active:opacity-90"
            style={{ borderRadius: 12 }}
          >
            <LinearGradient
              colors={[...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={[
                {
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                },
                SHADOW_GLOW,
              ]}
            >
              <Text className="text-sm font-semibold text-white">
                Show {count} {count === 1 ? 'place' : 'places'}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : hasPredicates ? (
          <Pressable
            onPress={resetDiscoveryFilters}
            className="h-12 w-full items-center justify-center rounded-xl bg-foreground active:opacity-90"
          >
            <Text className="text-sm font-semibold text-background">
              No matches — reset filters
            </Text>
          </Pressable>
        ) : (
          <View className="h-12 w-full items-center justify-center rounded-xl bg-muted/60">
            <Text className="text-sm font-medium text-muted-foreground">
              No places to show
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
