import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, motion, pressedOpacity, space } from "@/theme";

import { useActiveLocation } from "../location-context";
import type { ActiveLocation, CatalogPlace } from "../model";
import { useCatalog } from "../queries";

type Nav = { onOpenPlace: (placeId: string) => void; onChooseLocation: () => void };

export type HomeState =
  | { kind: "loading" }
  | { kind: "no-location" }
  | { kind: "empty" }
  | { kind: "error"; message: string; offline: boolean; requestId: string | null }
  | { kind: "places"; places: CatalogPlace[] };

export function HomeScreen(nav: Nav) {
  const { location } = useActiveLocation();
  const catalog = useCatalog(location ?? null);
  const copy = useErrorCopy(catalog.error);

  const state = (): HomeState => {
    if (location === undefined) return { kind: "loading" };
    if (location === null) return { kind: "no-location" };
    if (catalog.places.length > 0) return { kind: "places", places: catalog.places };
    if (catalog.fetchStatus === "paused") return { kind: "error", message: "", offline: true, requestId: null };
    if (catalog.isError) return { kind: "error", ...copy };
    return catalog.isPending ? { kind: "loading" } : { kind: "empty" };
  };

  return (
    <HomeView
      {...nav}
      state={state()}
      location={location ?? null}
      refreshing={catalog.isRefetching && !catalog.isFetchingNextPage}
      onRefresh={() => void catalog.refetch()}
      onEnd={() => {
        if (catalog.hasNextPage && !catalog.isFetching) void catalog.fetchNextPage();
      }}
    />
  );
}

type ViewProps = Nav & {
  state: HomeState;
  location: ActiveLocation | null;
  refreshing: boolean;
  onRefresh: () => void;
  onEnd: () => void;
};

const COLUMNS = 3;

export function HomeView({ state, location, refreshing, onRefresh, onEnd, onOpenPlace, onChooseLocation }: ViewProps) {
  if (state.kind === "loading") return <HomeSkeleton />;
  if (state.kind === "no-location") {
    const action = { label: "Choose a location", onPress: onChooseLocation };
    return <EmptyState message="Choose where you are to see the places near you." action={action} />;
  }
  if (state.kind === "error") {
    return <ErrorState message={state.message} offline={state.offline} requestId={state.requestId} onRetry={onRefresh} />;
  }
  if (state.kind === "empty") {
    return <EmptyState message="No places here yet." action={{ label: "Change location", onPress: onChooseLocation }} />;
  }
  return (
    <FlashList
      testID="catalog"
      data={state.places}
      numColumns={COLUMNS}
      keyExtractor={(place) => place.id}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onEndReached={onEnd}
      ListHeaderComponent={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Location: ${location?.name}. Change`}
          onPress={onChooseLocation}
          testID="location"
          style={({ pressed }) => [styles.header, pressed && { opacity: pressedOpacity }]}
        >
          <Text role="heading" numberOfLines={1}>
            {location?.name}
          </Text>
        </Pressable>
      }
      renderItem={({ item }) => <PlaceTile place={item} onPress={() => onOpenPlace(item.id)} />}
    />
  );
}

function PlaceTile({ place, onPress }: { place: CatalogPlace; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[place.name, place.category, place.isAd ? "Ad" : null].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: pressedOpacity }]}
    >
      <Image source={place.photo} style={styles.photo} contentFit="cover" transition={motion.fast} recyclingKey={place.id} />
      <View style={styles.name}>
        <Text role="caption" numberOfLines={1} style={styles.words}>
          {place.name}
        </Text>
        {place.isAd ? (
          <Text role="caption" tone="muted">
            Ad
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function HomeSkeleton() {
  return (
    <View style={styles.skeleton} testID="home-skeleton">
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={styles.skeletonTile}>
          <Skeleton style={styles.photo} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.lg, paddingVertical: space.sm },
  tile: { flex: 1, margin: StyleSheet.hairlineWidth, backgroundColor: colors.paper },
  photo: { width: "100%", aspectRatio: 1, backgroundColor: colors.fill },
  name: { flexDirection: "row", gap: space.xs, padding: space.sm },
  words: { flex: 1 },
  skeleton: { flex: 1, flexDirection: "row", flexWrap: "wrap", backgroundColor: colors.page },
  skeletonTile: { width: `${100 / COLUMNS}%`, padding: StyleSheet.hairlineWidth },
});
