import { FlashList } from "@shopify/flash-list";
import { useEffect } from "react";
import { RefreshControl, Share, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { useRequireAccount, useSession } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, radius, space } from "@/theme";

import { FamilyStrip } from "../components/family-strip";
import { HomeHeader } from "../components/home-header";
import { PlaceCard } from "../components/place-card";
import { chipsFor, CHIPS, type Chip, type ChipKey } from "../families";
import { useActiveLocation } from "../location-context";
import { shareUrl, type CatalogPlace } from "../model";
import { useCatalog, useRecordShare, useSaved, useToggleSaved } from "../queries";

type Nav = {
  onOpenPlace: (placeId: string) => void;
  onChooseLocation: () => void;
  onMenu: () => void;
  onWelcome: () => void;
};

export type HomeState =
  | { kind: "loading" }
  | { kind: "no-location" }
  | { kind: "empty" }
  | { kind: "nothing-saved" }
  | { kind: "error"; message: string; offline: boolean; requestId: string | null }
  | { kind: "places"; places: CatalogPlace[] };

// Asked once each time the app opens, like the web's each load, until the
// guest has an account.
let welcomed = false;

export function HomeScreen(nav: Nav) {
  const { location, chip, selectChip } = useActiveLocation();
  const member = useSession().guestId !== null;
  const shown: ChipKey = chip === "saved" && !member ? "near" : chip;
  const catalog = useCatalog(location ?? null, shown);
  const saved = useSaved();
  const toggle = useToggleSaved();
  const recordShare = useRecordShare();
  const requireAccount = useRequireAccount();
  const onSaved = shown === "saved";
  const read = onSaved ? saved : catalog;
  const copy = useErrorCopy(read.error);
  const { onWelcome } = nav;

  useEffect(() => {
    if (member || welcomed) return;
    welcomed = true;
    onWelcome();
  }, [member, onWelcome]);

  const state = (): HomeState => {
    if (location === undefined) return { kind: "loading" };
    if (location === null) return { kind: "no-location" };
    const places = onSaved ? (saved.data?.places ?? []) : catalog.places;
    if (places.length > 0) return { kind: "places", places };
    if (read.fetchStatus === "paused") return { kind: "error", message: "", offline: true, requestId: null };
    if (read.isError) return { kind: "error", ...copy };
    if (read.isPending) return { kind: "loading" };
    return onSaved ? { kind: "nothing-saved" } : { kind: "empty" };
  };

  const isSaved = (id: string) => saved.data?.ids.includes(id) ?? false;

  const share = async (place: CatalogPlace) => {
    const url = shareUrl(place);
    const done = await Share.share({ message: `${place.name}\n${url}` }).catch(() => null);
    if (member && done?.action === Share.sharedAction) recordShare.mutate(place.id);
  };

  return (
    <HomeView
      {...nav}
      state={state()}
      location={location?.name ?? "No location"}
      chips={chipsFor(member)}
      chip={shown}
      onChip={selectChip}
      isSaved={isSaved}
      onSave={(place) => {
        if (requireAccount("/")) toggle.mutate({ place, on: !isSaved(place.id) });
      }}
      onShare={(place) => void share(place)}
      refreshing={read.isRefetching && !catalog.isFetchingNextPage}
      onRefresh={() => void read.refetch()}
      onEnd={() => {
        if (!onSaved && catalog.hasNextPage && !catalog.isFetching) void catalog.fetchNextPage();
      }}
    />
  );
}

type ViewProps = Nav & {
  state: HomeState;
  location: string;
  chips: readonly Chip[];
  chip: ChipKey;
  onChip: (key: ChipKey) => void;
  isSaved: (id: string) => boolean;
  onSave: (place: CatalogPlace) => void;
  onShare: (place: CatalogPlace) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onEnd: () => void;
};

export function HomeView(props: ViewProps) {
  // No location: the one button, and nothing else.
  if (props.state.kind === "no-location") {
    return (
      <View style={styles.none} testID="empty-state">
        <Button label="Choose location" icon="map-pin" onPress={props.onChooseLocation} />
      </View>
    );
  }
  return (
    <View style={styles.page}>
      <HomeHeader location={props.location} onPress={props.onChooseLocation} />
      <FamilyStrip chips={props.chips} chosen={props.chip} onSelect={props.onChip} onMenu={props.onMenu} />
      <Body {...props} />
    </View>
  );
}

function Body(props: ViewProps) {
  const { state } = props;
  if (state.kind === "loading") return <HomeSkeleton />;
  if (state.kind === "error") {
    return (
      <ErrorState
        title="Couldn't load the catalog"
        message={state.message}
        offline={state.offline}
        requestId={state.requestId}
        onRetry={props.onRefresh}
      />
    );
  }
  if (state.kind === "nothing-saved") {
    return (
      <EmptyState icon="heart" title="Nothing saved yet" message="Tap the heart on a place and it lands here." />
    );
  }
  if (state.kind !== "places") {
    const label = CHIPS.find((c) => c.key === props.chip)?.label ?? "Places";
    return props.chip === "near" || props.chip === "all" ? (
      <EmptyState title="No places yet" message="Check back soon." />
    ) : (
      <EmptyState title={`Nothing in ${label} here yet`} message="Try another family, or another location." />
    );
  }
  return (
    <FlashList
      key={props.chip}
      testID="catalog"
      data={state.places}
      extraData={props.isSaved}
      keyExtractor={(place) => place.id}
      refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} />}
      onEndReached={props.onEnd}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <PlaceCard
          place={item}
          saved={props.isSaved(item.id)}
          onOpen={() => props.onOpenPlace(item.id)}
          onSave={() => props.onSave(item)}
          onShare={() => props.onShare(item)}
        />
      )}
    />
  );
}

function HomeSkeleton() {
  return (
    <View style={styles.page} testID="home-skeleton">
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={styles.skeleton}>
          <Skeleton style={styles.half} />
          <View style={[styles.half, styles.paper]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  none: { flex: 1, justifyContent: "center", paddingHorizontal: 40, backgroundColor: colors.page },
  list: { paddingBottom: 100 },
  skeleton: { flexDirection: "row", marginHorizontal: space.sm, marginTop: space.sm, overflow: "hidden", borderRadius: radius.card },
  half: { flex: 1, aspectRatio: 1, borderRadius: 0 },
  paper: { borderWidth: 1, borderLeftWidth: 0, borderColor: colors.border },
});
