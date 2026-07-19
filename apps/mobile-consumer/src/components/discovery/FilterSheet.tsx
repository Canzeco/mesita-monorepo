import { Clock, SlidersHorizontal, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from "@/constants/brand";
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
} from "@/lib/discovery-filters-engine";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  resetDiscoveryFilters,
  setDiscoveryMaxKm,
  setDiscoveryRandomness,
  setDiscoveryWhen,
  toggleDiscoveryCategory,
  toggleDiscoveryFamily,
  useDiscoveryFilters,
} from "@/lib/use-discovery-filters";
import { DiscoveryZoneField } from "./DiscoveryZoneField";
import { Pill, RangeSlider, SectionLabel } from "./filter-controls";

// Discovery filters (MESITA-646/650, five-parameter rebuild MESITA-672): the
// shared sheet — Where · Distance · When · What · Randomness — opened from the
// Filter button in the swipe action bar and from the Search bar's tune icon.
// RN port of web FilterSheet + DiscoveryFilters, folded into ONE bottom-sheet
// modal (the shape it replaces — FiltersComingSoon). Filter state lives in the
// global use-discovery-filters store — not in the sheet — so it survives
// close/unmount, is identical on both surfaces, and hosts derive their trigger
// dot from the same store. Hosts pass the catalog-derived category options + the
// live count + whether device location is available.

const PRIMARY = "#fb2b7b";
const MUTED_FG = "#775254";

export function FilterSheet({
  open,
  onClose,
  categoryOptions,
  count,
  hasLocation,
}: {
  open: boolean;
  onClose: () => void;
  /** Concrete categories present in the host's catalog, biggest first. */
  categoryOptions: CategoryOption[];
  /** How many places the current filters leave visible on the host. */
  count: number;
  /** Geolocation granted — enables the "distance from me" default. */
  hasLocation: boolean;
}) {
  const insets = useSafeAreaInsets();
  const filters = useDiscoveryFilters();
  const hasPredicates = hasDiscoveryPredicates(filters);
  // A center to measure distance from — a searched zone or the device fix.
  const hasCenter = filters.zone !== null || hasLocation;
  const when = filters.when;

  const startAt = () => {
    const now = new Date();
    setDiscoveryWhen({ mode: "at", day: now.getDay(), hour: now.getHours() });
  };

  const staleCategories = filters.categories.filter(
    (slug) => !categoryOptions.some((c) => c.slug === slug),
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl border-t border-border bg-card"
          style={{ maxHeight: "90%" }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header — the sheet's ONE tinted icon circle + Reset ghost + close. */}
          <View className="flex-row items-center justify-between px-4 pb-3 pt-3">
            <View className="flex-row items-center gap-2.5">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <SlidersHorizontal color={PRIMARY} size={16} />
              </View>
              <Text
                className="font-display font-semibold text-foreground"
                style={{ fontSize: 18 }}
              >
                Filters
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Pressable
                onPress={resetDiscoveryFilters}
                accessibilityRole="button"
                accessibilityLabel="Reset filters"
                hitSlop={10}
                className="rounded-full px-3 py-1.5 active:bg-muted"
              >
                <Text
                  className="font-medium text-muted-foreground"
                  style={{ fontSize: 12 }}
                >
                  Reset
                </Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                className="h-8 w-8 items-center justify-center rounded-full active:bg-muted"
              >
                <X color={MUTED_FG} size={16} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Module 1 · Where ─────────────────────────────────────── */}
            <SectionLabel>Where</SectionLabel>
            <DiscoveryZoneField zone={filters.zone} hasLocation={hasLocation} />

            {/* ── Module 2 · Distance ──────────────────────────────────── */}
            <SectionLabel className="mt-5">Distance</SectionLabel>
            {hasCenter ? (
              <>
                <View className="mb-1 flex-row items-center gap-3">
                  <Pill
                    active={filters.maxKm === null}
                    onPress={() => setDiscoveryMaxKm(null)}
                  >
                    Any
                  </Pill>
                  <Text
                    className="ml-auto font-display font-semibold text-foreground"
                    style={{ fontSize: 16, fontVariant: ["tabular-nums"] }}
                  >
                    {filters.maxKm === null
                      ? "Any distance"
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
              <Text className="text-muted-foreground/70" style={{ fontSize: 11 }}>
                Pick a location above or turn on device location to filter by
                distance.
              </Text>
            )}

            {/* ── Module 3 · When ──────────────────────────────────────── */}
            <SectionLabel className="mt-5">When</SectionLabel>
            <View className="flex-row flex-wrap gap-1.5">
              <Pill
                active={when.mode === "now"}
                onPress={() => setDiscoveryWhen({ mode: "now" })}
                icon={
                  <Clock
                    color={when.mode === "now" ? "#ffffff" : MUTED_FG}
                    size={14}
                  />
                }
              >
                Now
              </Pill>
              <Pill
                active={when.mode === "anytime"}
                onPress={() => setDiscoveryWhen({ mode: "anytime" })}
              >
                Anytime
              </Pill>
              <Pill active={when.mode === "at"} onPress={startAt}>
                Pick a time
              </Pill>
            </View>
            {when.mode === "at" ? (
              <View className="mt-3">
                <View className="flex-row flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((label, day) => (
                    <Pill
                      key={label}
                      active={when.day === day}
                      onPress={() =>
                        setDiscoveryWhen({ mode: "at", day, hour: when.hour })
                      }
                    >
                      {label}
                    </Pill>
                  ))}
                </View>
                <View className="mt-3 flex-row items-center">
                  <Text
                    className="font-semibold text-muted-foreground"
                    style={{ fontSize: 11, letterSpacing: 0.3 }}
                  >
                    Open at
                  </Text>
                  <Text
                    className="ml-auto font-display font-semibold text-foreground"
                    style={{ fontSize: 16, fontVariant: ["tabular-nums"] }}
                  >
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
                    setDiscoveryWhen({ mode: "at", day: when.day, hour })
                  }
                />
              </View>
            ) : null}

            {/* ── Module 4 · What ──────────────────────────────────────── */}
            <SectionLabel className="mt-5">What</SectionLabel>
            <View className="flex-row flex-wrap gap-1.5">
              {PLACE_FAMILIES.map((family) => (
                <Pill
                  key={family.key}
                  active={filters.familyKeys.includes(family.key)}
                  onPress={() => toggleDiscoveryFamily(family.key)}
                  accessibilityLabel={family.label}
                >
                  {`${family.emoji} ${family.label}`}
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
                      onPress={() => toggleDiscoveryCategory(option.slug)}
                    >
                      {option.label}
                    </Pill>
                  ))}
                  {staleCategories.map((slug) => (
                    <Pill
                      key={slug}
                      active
                      onPress={() => toggleDiscoveryCategory(slug)}
                    >
                      {slug}
                    </Pill>
                  ))}
                </View>
              </>
            ) : null}

            {/* ── Module 5 · Randomness ────────────────────────────────── */}
            <SectionLabel className="mt-5">Randomness</SectionLabel>
            <View className="mb-1 flex-row items-center justify-between">
              <Text
                className="font-medium text-muted-foreground"
                style={{ fontSize: 11 }}
              >
                {RANDOMNESS_ENDPOINTS.min}
              </Text>
              <Text
                className="font-display font-semibold text-foreground"
                style={{ fontSize: 16, fontVariant: ["tabular-nums"] }}
              >
                {filters.randomness}
              </Text>
              <Text
                className="font-medium text-muted-foreground"
                style={{ fontSize: 11 }}
              >
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

          {/* Footer CTA — live count feedback + close. Zero splits two ways: a
              narrowing predicate set flips it into the reset escape (dead end,
              one tap out); nothing filtered means the host is simply empty, so
              Reset can't help — a neutral, non-actionable note stands in
              (MESITA-670). */}
          <View
            className="border-t border-border/60 p-4"
            style={{ paddingBottom: 16 + insets.bottom }}
          >
            {count > 0 ? (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={`Show ${count} ${count === 1 ? "place" : "places"}`}
                style={({ pressed }) => [
                  { transform: [{ scale: pressed ? 0.99 : 1 }] },
                  SHADOW_GLOW,
                ]}
              >
                <View style={{ borderRadius: 12, overflow: "hidden" }}>
                  <LinearGradient
                    colors={GRADIENTS.pink}
                    start={GRADIENT_DIAGONAL.start}
                    end={GRADIENT_DIAGONAL.end}
                  >
                    <View className="h-12 items-center justify-center">
                      <Text
                        className="font-semibold text-white"
                        style={{ fontSize: 14 }}
                      >
                        Show {count} {count === 1 ? "place" : "places"}
                      </Text>
                    </View>
                  </LinearGradient>
                </View>
              </Pressable>
            ) : hasPredicates ? (
              <Pressable
                onPress={resetDiscoveryFilters}
                accessibilityRole="button"
                accessibilityLabel="No matches — reset filters"
                style={({ pressed }) => [
                  { transform: [{ scale: pressed ? 0.99 : 1 }] },
                ]}
                className="h-12 items-center justify-center rounded-2xl bg-foreground"
              >
                <Text
                  className="font-semibold text-background"
                  style={{ fontSize: 14 }}
                >
                  No matches — reset filters
                </Text>
              </Pressable>
            ) : (
              <View className="h-12 items-center justify-center rounded-2xl bg-muted">
                <Text
                  className="font-medium text-muted-foreground"
                  style={{ fontSize: 14 }}
                >
                  No places to show
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
