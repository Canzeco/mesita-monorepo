// The wallet (v4 · MESITA-1094) — mobile mirror of web's PlacePickList:
// EVERY Mesita place, listed flat, narrowed by the header's search field.
// The query is owned by the wallet screen; matching happens here where the
// rows live, client-side over the ≤100 loaded rows (place-list-filter, the
// same module web uses).
//
// Non-partners are shown, not hidden (MESITA-817). Hiding them meant a guest
// whose catalog is all `web` listings saw an empty tab and concluded the page
// was broken. They get a LOCKED treatment instead (MESITA-819) — padlock pill,
// dimmed thumbnail, muted name, no tap target — because
// consumer-web-create-ticket 409s `not_partner`, so a tap is a dead end.
// Partners sort first.

import { Image } from "expo-image";
import { ChevronRight, Lock, MapPin, QrCode, Store } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { apiFetchPublicPlaces, type Place } from "@/lib/api/places";
import { filterPlacesByQuery } from "@/lib/place-list-filter";
import { supabase } from "@/lib/supabase";

export function PlacePickList({
  activePlaceIds,
  busyPlaceId = null,
  onPick,
  query = "",
  onClearQuery,
}: {
  /** Places that already hold a live ticket — rows get an "Open" chip. */
  activePlaceIds: ReadonlySet<string>;
  /** Place whose ticket is being created right now — its row shows a spinner. */
  busyPlaceId?: string | null;
  onPick: (place: Place) => void;
  /** Header search query. Empty string = show everything. */
  query?: string;
  /** Lets the no-match state clear the field it cannot reach itself. */
  onClearQuery?: () => void;
}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetchPublicPlaces(supabase, 100);
        if (!cancelled) {
          setPlaces(rows);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Partners first — the rows you can actually act on lead the list.
  const sorted = useMemo(
    () =>
      [...places].sort((a, b) => {
        const ap = a.listing_type === "partner" ? 0 : 1;
        const bp = b.listing_type === "partner" ? 0 : 1;
        return ap !== bp ? ap - bp : a.name.localeCompare(b.name);
      }),
    [places],
  );
  // Rules and rationale live with the matcher in place-list-filter (shared
  // with web); this only decides WHEN to apply them.
  const visible = useMemo(
    () => filterPlacesByQuery(sorted, query),
    [sorted, query],
  );
  const anyLocked = visible.some((p) => p.listing_type !== "partner");

  if (status === "loading") {
    return <ActivityIndicator style={{ paddingVertical: 24 }} />;
  }

  if (status === "error") {
    return (
      <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <Text className="text-muted-foreground" style={{ fontSize: 12.5 }}>
          Couldn&apos;t load the places.
        </Text>
        <Pressable
          onPress={() => {
            setStatus("loading");
            setReloadKey((k) => k + 1);
          }}
          accessibilityRole="button"
        >
          <Text
            className="font-semibold text-primary"
            style={{ fontSize: 12.5 }}
          >
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  if (sorted.length === 0) {
    return (
      <View className="items-center gap-2 rounded-2xl border border-border bg-card px-4 py-8">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
          <MapPin size={20} color="#775254" />
        </View>
        <Text className="text-muted-foreground" style={{ fontSize: 12.5 }}>
          No places on Mesita yet — check back soon.
        </Text>
      </View>
    );
  }

  // A query that matches nothing is NOT an empty catalog — the way out ships
  // with the message, since the field lives in the header out of reach.
  if (visible.length === 0) {
    return (
      <View className="items-center gap-2 rounded-2xl border border-border bg-card px-4 py-8">
        <Text className="text-muted-foreground" style={{ fontSize: 12.5 }}>
          No place matches{" "}
          <Text className="font-semibold text-foreground">{query.trim()}</Text>.
        </Text>
        {onClearQuery ? (
          <Pressable onPress={onClearQuery} accessibilityRole="button">
            <Text
              className="font-semibold text-primary"
              style={{ fontSize: 12.5 }}
            >
              Clear search
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        {visible.map((p, i) => (
          <PlaceRow
            key={p.id}
            place={p}
            hasOpen={activePlaceIds.has(p.id)}
            busy={busyPlaceId === p.id}
            onPick={onPick}
            first={i === 0}
          />
        ))}
      </View>
      {anyLocked ? (
        <Text
          className="px-1 text-muted-foreground"
          style={{ fontSize: 11, lineHeight: 15 }}
        >
          Only Mesita Partners run the Mesita reward program — the rest are on
          Mesita, but can&apos;t open a ticket yet.
        </Text>
      ) : null}
    </View>
  );
}

function PlaceRow({
  place,
  hasOpen,
  busy = false,
  onPick,
  first,
}: {
  place: Place;
  hasOpen: boolean;
  busy?: boolean;
  onPick: (place: Place) => void;
  first: boolean;
}) {
  const isPartner = place.listing_type === "partner";
  const photo = place.photos?.[0] ?? null;
  const subtitle =
    [place.zone, place.category_label ?? place.category]
      .filter(Boolean)
      .join(" · ") || (isPartner ? "Mesita partner" : "On Mesita");

  const body = (
    <>
      {photo ? (
        // The THUMBNAIL carries the inactive state, not the whole row —
        // blanket row opacity reads as a rendering glitch and costs
        // legibility. (RN has no CSS grayscale, so dimming alone.)
        <Image
          source={{ uri: photo }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            opacity: isPartner ? 1 : 0.5,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          className={`h-12 w-12 items-center justify-center rounded-xl ${
            isPartner ? "bg-secondary/10" : "bg-muted"
          }`}
        >
          <Store size={20} color={isPartner ? "#cf0360" : "#775254"} />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text
          className={`font-bold ${
            isPartner ? "text-foreground" : "text-muted-foreground"
          }`}
          numberOfLines={1}
          style={{ fontSize: 13.5 }}
        >
          {place.name}
        </Text>
        <Text
          className="mt-0.5 text-muted-foreground"
          numberOfLines={1}
          style={{ fontSize: 11.5, opacity: 0.8 }}
        >
          {subtitle}
        </Text>
      </View>
      {!isPartner ? (
        // One unambiguous locked signal, in one place.
        <View className="flex-row items-center gap-1 rounded-full bg-muted px-2 py-0.5">
          <Lock size={10} color="#775254" />
          <Text
            className="font-extrabold uppercase text-muted-foreground"
            style={{ fontSize: 10, letterSpacing: 0.5 }}
          >
            Soon
          </Text>
        </View>
      ) : hasOpen ? (
        <View className="rounded-full bg-primary/10 px-2 py-0.5">
          <Text
            className="font-extrabold uppercase text-primary"
            style={{ fontSize: 10, letterSpacing: 0.5 }}
          >
            Open
          </Text>
        </View>
      ) : (
        <>
          {/* Ghost QR — the row's promise, made visible. A dashed placeholder
              reads "your QR comes from here, tap it", which a bare chevron
              never says. Deliberately NOT a scannable code: nothing exists
              until the ticket is created. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="h-9 w-9 items-center justify-center rounded-lg border border-dashed border-primary/30 bg-primary/5"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#cf0360" />
            ) : (
              <QrCode size={18} color="#cf0360" opacity={0.7} />
            )}
          </View>
          <ChevronRight size={16} color="#775254" />
        </>
      )}
    </>
  );

  const rowClass = `flex-row items-center gap-3 px-3.5 py-3 ${
    first ? "" : "border-t border-border"
  }`;

  // Non-partners are visible but inert: create-ticket would 409 `not_partner`.
  if (!isPartner) {
    return (
      <View accessibilityState={{ disabled: true }} className={rowClass}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPick(place)}
      accessibilityRole="button"
      className={`${rowClass} active:bg-muted/50`}
    >
      {body}
    </Pressable>
  );
}
