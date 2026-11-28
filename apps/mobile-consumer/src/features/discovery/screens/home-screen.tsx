import { FlashList } from "@shopify/flash-list";
import { useEffect, useState, type ReactNode } from "react";
import { RefreshControl, Share, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { RemoveSaved } from "@/components/remove-saved";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { useRequireAccount, useSession } from "@/features/auth";
import { colors, radius } from "@/theme";

import { FamilyStrip } from "../components/family-strip";
import { GenerateSheet, type GenerateTarget } from "../components/generate-sheet";
import { HomeHeader } from "../components/home-header";
import { PlaceCard } from "../components/place-card";
import { chipsFor, CHIPS, type Chip, type ChipKey } from "../families";
import { useActiveLocation } from "../location-context";
import { shareUrl, type CatalogPlace } from "../model";
import type { CatalogRank } from "../api";
import { useCachedRank, useCatalog, useRecordShare, useSaved, useShareCode, useToggleSaved } from "../queries";

type Nav = {
  onOpenPlace: (placeId: string) => void;
  onReserve: (placeId: string) => void;
  onChooseLocation: () => void;
  onMenu: () => void;
  onWelcome: () => void;
  /** The Categories window is up (Menu wears its open state). */
  menuOpen?: boolean;
  /** The Social chip's body: the feed, in Home's own scroller (MESITA-4758). */
  social?: ReactNode;
};

export type HomeState =
  | { kind: "loading" }
  | { kind: "no-location" }
  | { kind: "social" }
  | { kind: "empty" }
  | { kind: "nothing-saved" }
  | { kind: "error"; offline: boolean }
  | { kind: "places"; places: CatalogPlace[] };

// Asked once each time the app opens, like the web's each load, until the
// guest has an account.
let welcomed = false;

export function HomeScreen(nav: Nav) {
  const { location, chip, selectChip, poolChip } = useActiveLocation();
  const member = useSession().guestId !== null;
  const shown: ChipKey = chip === "saved" && !member ? "near" : chip;
  const catalog = useCatalog(location ?? null, shown);
  const pooled = useCachedRank(location ?? null, poolChip);
  const saved = useSaved();
  const toggle = useToggleSaved();
  const [drop, setDrop] = useState<CatalogPlace | null>(null);
  const [generate, setGenerate] = useState<GenerateTarget | null>(null);
  const recordShare = useRecordShare();
  const shareCode = useShareCode();
  const requireAccount = useRequireAccount();
  const onSaved = shown === "saved";
  const read = onSaved ? saved : catalog;
  const { onWelcome } = nav;

  useEffect(() => {
    if (member || welcomed) return;
    welcomed = true;
    onWelcome();
  }, [member, onWelcome]);

  const state = (): HomeState => {
    if (location === undefined) return { kind: "loading" };
    if (location === null) return { kind: "no-location" };
    if (shown === "social") return { kind: "social" };
    const places = onSaved ? (saved.data?.places ?? []) : catalog.places;
    if (places.length > 0) return { kind: "places", places };
    if (read.fetchStatus === "paused") return { kind: "error", offline: true };
    if (read.isError) return { kind: "error", offline: false };
    if (read.isPending) return { kind: "loading" };
    return onSaved ? { kind: "nothing-saved" } : { kind: "empty" };
  };

  const isSaved = (id: string) => saved.data?.ids.includes(id) ?? false;

  const share = async (place: CatalogPlace) => {
    const url = shareUrl(place, shareCode);
    const done = await Share.share({ message: `${place.name}\n${url}` }).catch(() => null);
    if (member && done?.action === Share.sharedAction) recordShare.mutate(place.id);
  };

  return (
    <>
      <RemoveSaved
        name={drop?.name ?? null}
        onCancel={() => setDrop(null)}
        onConfirm={() => {
          if (drop) toggle.mutate({ place: drop, on: false });
          setDrop(null);
        }}
      />
      <GenerateSheet target={generate} onClose={() => setGenerate(null)} onOpen={nav.onOpenPlace} />
      <HomeView
        {...nav}
        state={state()}
        location={location === undefined ? null : (location?.name ?? null)}
        chips={chipsFor(member, true)}
        chip={shown}
        onChip={selectChip}
        isSaved={isSaved}
        // Saved rows have no rank (never an ad, no score position) but follow
        // the last rank's score switch, as on the web.
        rank={onSaved ? null : catalog.rank}
        showScores={(catalog.rank ?? pooled)?.showScores !== false}
        more={!onSaved && catalog.hasNextPage === true}
        onSave={(place) => {
          if (!requireAccount("/")) return;
          if (isSaved(place.id)) setDrop(place);
          else toggle.mutate({ place, on: true });
        }}
        onShare={(place) => void share(place)}
        onGenerate={(place) => (place.googleId ? setGenerate({ gid: place.googleId, name: place.name, address: null }) : undefined)}
        refreshing={read.isRefetching && !catalog.isFetchingNextPage}
        onRefresh={() => void read.refetch()}
        onEnd={() => {
          if (!onSaved && catalog.hasNextPage && !catalog.isFetching) void catalog.fetchNextPage();
        }}
      />
    </>
  );
}

type ViewProps = Nav & {
  state: HomeState;
  /** Null while the device's storage answers. */
  location: string | null;
  chips: readonly Chip[];
  chip: ChipKey;
  onChip: (key: ChipKey) => void;
  isSaved: (id: string) => boolean;
  rank: CatalogRank | null;
  showScores: boolean;
  /** Another page is coming: the web's 1 pt sentinel under the last row. */
  more: boolean;
  onSave: (place: CatalogPlace) => void;
  onShare: (place: CatalogPlace) => void;
  onGenerate: (place: CatalogPlace) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onEnd: () => void;
};

export function HomeView(props: ViewProps) {
  // No location: the web's LocationGate, one button on the grey, over the
  // rows' silhouette.
  if (props.state.kind === "no-location") {
    return (
      <View style={styles.none} testID="empty-state">
        <View style={styles.gate}>
          <Button label="Choose location" icon="map-pin" onPress={props.onChooseLocation} />
        </View>
      </View>
    );
  }
  // The strip shows once there is a point (the web hides it before).
  const point = props.location !== null;
  return (
    <View style={styles.page}>
      <HomeHeader location={props.location} onPress={props.onChooseLocation} />
      {point ? (
        <FamilyStrip chips={props.chips} chosen={props.chip} onSelect={props.onChip} onMenu={props.onMenu} menuOpen={props.menuOpen} />
      ) : (
        <StripSkeleton />
      )}
      <Body {...props} />
    </View>
  );
}

function Body(props: ViewProps) {
  const { state } = props;
  if (state.kind === "loading") return <RowsSkeleton />;
  if (state.kind === "social") return <>{props.social}</>;
  if (state.kind === "error") {
    return (
      <ErrorState
        title="Couldn't load the catalog"
        message="Tonight's places didn't come back. Try again in a moment."
        offline={state.offline}
        onRetry={props.onRefresh}
      />
    );
  }
  if (state.kind === "nothing-saved") {
    return <EmptyState icon="heart" title="Nothing saved yet" message="Tap the heart on a place and it lands here." />;
  }
  if (state.kind !== "places") {
    const label = CHIPS.find((c) => c.key === props.chip)?.label ?? "Places";
    return props.chip === "near" || props.chip === "all" ? (
      <EmptyState title="No places yet" message="Check back soon." />
    ) : (
      <EmptyState title={`Nothing in ${label} here yet`} message="Try another family, or another location." />
    );
  }
  const { rank, showScores } = props;
  return (
    <FlashList
      key={props.chip}
      testID="catalog"
      data={state.places}
      extraData={[props.isSaved, rank]}
      keyExtractor={(place) => place.id}
      refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} />}
      onEndReached={props.onEnd}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      ItemSeparatorComponent={Gap}
      ListFooterComponent={props.more ? Sentinel : null}
      renderItem={({ item, index }) => (
        <PlaceCard
          place={item}
          saved={props.isSaved(item.id)}
          showScores={showScores}
          ad={rank ? rank.adIds.includes(item.id) : false}
          rank={rank ? { pre: rank.preShuffle[item.id] ?? null, shown: index + 1 } : null}
          onOpen={() => props.onOpenPlace(item.id)}
          onReserve={() => props.onReserve(item.id)}
          onSave={() => props.onSave(item)}
          onShare={() => props.onShare(item)}
          onGenerate={item.googleOnly ? () => props.onGenerate(item) : undefined}
        />
      )}
    />
  );
}

/** One 8 pt step between rows (the web's ROW_LIST gap-2). */
function Gap() {
  return <View style={styles.gap} />;
}

/** The web's paging sentinel: an 8 gap and a 1 pt row under the last card. */
function Sentinel() {
  return <View style={styles.sentinel} />;
}

/** The web's strip silhouette: seven 56-wide columns, a 44 circle over a 10 × 32 bar. */
function StripSkeleton() {
  return (
    <View style={styles.strip} testID="strip-skeleton">
      {Array.from({ length: 7 }, (_, i) => (
        <View key={i} style={styles.stripColumn}>
          <Skeleton style={styles.stripCircle} />
          <Skeleton style={styles.stripName} />
        </View>
      ))}
    </View>
  );
}

/** The web's RowFallback: four rows, block for block, so nothing moves when the places land. */
function RowsSkeleton() {
  return (
    <View style={styles.list} testID="home-skeleton">
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.rowGap]}>
          <View style={styles.photo}>
            <View style={styles.square} />
            <Skeleton style={styles.photoFill} />
          </View>
          <View style={styles.info}>
            <Skeleton style={[styles.bar16, { width: "80%" }]} />
            <Skeleton style={[styles.bar12, { width: "50%" }]} />
            <Skeleton style={[styles.bar12, { width: "40%" }]} />
            <Skeleton style={[styles.bar12, { width: "60%" }]} />
            <View style={styles.bottom}>
              <Skeleton style={styles.button} />
              <View style={styles.pair}>
                <Skeleton style={[styles.button, styles.flex]} />
                <Skeleton style={[styles.button, styles.flex]} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  // The web's LocationGate: the grey, 24 in, the button min(320, the width).
  none: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: colors.page },
  gate: { width: "100%", maxWidth: 320 },
  list: { padding: 8 },
  gap: { height: 8 },
  sentinel: { height: 9 },
  strip: {
    flexDirection: "row",
    gap: 2,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 6,
    overflow: "hidden",
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  stripColumn: { width: 56, alignItems: "center", gap: 2, paddingBottom: 4 },
  stripCircle: { width: 44, height: 44, borderRadius: radius.full },
  stripName: { width: 32, height: 10 },
  row: { flexDirection: "row" },
  rowGap: { marginTop: 8 },
  photo: { flex: 1, overflow: "hidden", backgroundColor: colors.fill, borderTopLeftRadius: radius["2xl"], borderBottomLeftRadius: radius["2xl"] },
  square: { width: "100%", aspectRatio: 1 },
  photoFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 0 },
  info: {
    flex: 1,
    gap: 8,
    padding: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: colors.border,
    borderTopRightRadius: radius["2xl"],
    borderBottomRightRadius: radius["2xl"],
  },
  bar16: { height: 16 },
  bar12: { height: 12 },
  bottom: { marginTop: "auto", gap: 8 },
  pair: { flexDirection: "row", gap: 8 },
  button: { height: 32 },
});
