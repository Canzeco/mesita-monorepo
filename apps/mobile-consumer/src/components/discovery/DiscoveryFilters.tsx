import { Clock, SlidersHorizontal, X } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  FilterGroupLabel,
  FilterModule,
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
  RANDOMNESS_LABELS,
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

// Shared body of the discovery Filters route modal — RN port of web
// DiscoveryFilters (MESITA-905 simplify + routed /filters). Each INTENT /
// Random section sits in a FilterModule box (MESITA-957).

export function DiscoveryFilters({
  onClose,
  categoryOptions,
  count,
  hasLocation,
}: {
  onClose: () => void;
  categoryOptions: CategoryOption[];
  /** Live host count; null = cold open / unknown host → CTA "Done". */
  count: number | null;
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

  const distanceKm = filters.maxKm ?? DISTANCE_MAX_KM;

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
        horizontal={false}
      >
        <FilterGroupLabel>Intent · where when what that</FilterGroupLabel>

        <View className="gap-3">
        <FilterModule label="Where">
          <DiscoveryZoneField zone={filters.zone} hasLocation={hasLocation} />

          <SectionLabel className="mt-3" sub>
            Distance tolerance
          </SectionLabel>
          {hasCenter ? (
            <>
              <View className="mb-1 flex-row justify-end">
                <Text className="text-sm font-semibold tabular-nums text-foreground">
                  {filters.maxKm === null
                    ? 'Any'
                    : `within ${filters.maxKm} km`}
                </Text>
              </View>
              <RangeSlider
                className="mt-2"
                min={DISTANCE_MIN_KM}
                max={DISTANCE_MAX_KM}
                value={distanceKm}
                ariaLabel="Distance tolerance in kilometres"
                onChange={(km) =>
                  setDiscoveryMaxKm(km >= DISTANCE_MAX_KM ? null : km)
                }
              />
              <View className="mt-1 flex-row justify-between">
                <Text className="text-[10px] text-muted-foreground">
                  {DISTANCE_MIN_KM} km
                </Text>
                <Text className="text-[10px] text-muted-foreground">Any</Text>
              </View>
            </>
          ) : (
            <Text className="text-[11px] text-muted-foreground/70">
              Pick a location above or turn on device location to filter by
              distance.
            </Text>
          )}
        </FilterModule>

        <FilterModule label="When">
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
        </FilterModule>

        <FilterModule label="What">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-grow-0"
            contentContainerStyle={{ gap: 6 }}
          >
            {PLACE_FAMILIES.map((family) => (
              <Pill
                key={family.key}
                active={filters.familyKeys.includes(family.key)}
                onClick={() => toggleDiscoveryFamily(family.key)}
              >
                {family.emoji} {family.label}
              </Pill>
            ))}
          </ScrollView>
          {categoryOptions.length > 1 || staleCategories.length > 0 ? (
            <>
              <SectionLabel className="mt-3" sub>
                Categories
              </SectionLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-grow-0"
                contentContainerStyle={{ gap: 6 }}
              >
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
              </ScrollView>
            </>
          ) : null}
        </FilterModule>

        <FilterModule label="That · the ask">
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
            Shapes your lineup once the engine reads it — doesn&apos;t narrow
            the list yet.
          </Text>
        </FilterModule>

        <FilterModule label="Random">
          <View className="mb-1 flex-row items-center justify-between">
            {RANDOMNESS_LABELS.map((label, i) => (
              <Text
                key={label}
                className={
                  filters.randomness === i
                    ? 'text-[11px] font-semibold text-foreground'
                    : 'text-[11px] font-medium text-muted-foreground'
                }
              >
                {label}
              </Text>
            ))}
          </View>
          <RangeSlider
            min={RANDOMNESS_MIN}
            max={RANDOMNESS_MAX}
            value={filters.randomness}
            ariaLabel="Random level"
            onChange={(n) => setDiscoveryRandomness(n as RandomnessLevel)}
          />
        </FilterModule>
        </View>
      </ScrollView>

      <View className="shrink-0 border-t border-border/60 p-4">
        {count != null && count > 0 ? (
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
        ) : count === 0 && hasPredicates ? (
          <Pressable
            onPress={resetDiscoveryFilters}
            className="h-12 w-full items-center justify-center rounded-xl bg-foreground active:opacity-90"
          >
            <Text className="text-sm font-semibold text-background">
              No matches — reset filters
            </Text>
          </Pressable>
        ) : count === 0 ? (
          <View className="h-12 w-full items-center justify-center rounded-xl bg-muted/60">
            <Text className="text-sm font-medium text-muted-foreground">
              No places to show
            </Text>
          </View>
        ) : (
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
              <Text className="text-sm font-semibold text-white">Done</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}
