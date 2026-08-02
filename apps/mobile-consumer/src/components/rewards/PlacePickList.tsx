// The New tab (Wallet v3, MESITA-811 · MESITA-817) — mobile mirror: EVERY
// Mesita place, listed flat — deliberately no searchbar yet, per Pato ("just
// list all the places; then we see how we solve the searchbar").
//
// Non-partners are shown, not hidden (MESITA-817). Hiding them meant a guest
// whose catalog is all `web` listings saw an empty tab and concluded the page
// was broken. They render dimmed and untappable instead, because
// consumer-web-create-ticket 409s `not_partner` — a tap would be a dead end.
// Partners sort first.

import { Image } from 'expo-image';
import { ChevronRight, MapPin, Store } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { apiFetchPublicPlaces, type Place } from '@/lib/api/places';
import { supabase } from '@/lib/supabase';

export function PlacePickList({
  activePlaceIds,
  onPick,
}: {
  /** Places that already hold a live ticket — rows get an "Open" chip. */
  activePlaceIds: ReadonlySet<string>;
  onPick: (place: Place) => void;
}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetchPublicPlaces(supabase, 100);
        if (!cancelled) {
          setPlaces(rows);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
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
        const ap = a.listing_type === 'partner' ? 0 : 1;
        const bp = b.listing_type === 'partner' ? 0 : 1;
        return ap !== bp ? ap - bp : a.name.localeCompare(b.name);
      }),
    [places],
  );
  const anyLocked = sorted.some((p) => p.listing_type !== 'partner');

  if (status === 'loading') {
    return <ActivityIndicator style={{ paddingVertical: 24 }} />;
  }

  if (status === 'error') {
    return (
      <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <Text className="text-muted-foreground" style={{ fontSize: 12.5 }}>
          Couldn&apos;t load the places.
        </Text>
        <Pressable
          onPress={() => {
            setStatus('loading');
            setReloadKey((k) => k + 1);
          }}
          accessibilityRole="button"
        >
          <Text className="font-semibold text-primary" style={{ fontSize: 12.5 }}>
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

  return (
    <View style={{ gap: 8 }}>
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        {sorted.map((p, i) => (
          <PlaceRow
            key={p.id}
            place={p}
            hasOpen={activePlaceIds.has(p.id)}
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
          Only Verified Partners run the Mesita reward program — the rest are on
          Mesita, but can&apos;t open a ticket yet.
        </Text>
      ) : null}
    </View>
  );
}

function PlaceRow({
  place,
  hasOpen,
  onPick,
  first,
}: {
  place: Place;
  hasOpen: boolean;
  onPick: (place: Place) => void;
  first: boolean;
}) {
  const isPartner = place.listing_type === 'partner';
  const photo = place.photos?.[0] ?? null;
  const subtitle =
    [place.zone, place.category_label ?? place.category]
      .filter(Boolean)
      .join(' · ') || (isPartner ? 'Mesita partner' : 'On Mesita');

  const body = (
    <>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: 48, height: 48, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : (
        <View
          className={`h-12 w-12 items-center justify-center rounded-xl ${
            isPartner ? 'bg-secondary/10' : 'bg-muted'
          }`}
        >
          <Store size={20} color={isPartner ? '#cf0360' : '#775254'} />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text
          className="font-bold text-foreground"
          numberOfLines={1}
          style={{ fontSize: 13.5 }}
        >
          {place.name}
        </Text>
        <Text
          className="mt-0.5 text-muted-foreground"
          numberOfLines={1}
          style={{ fontSize: 11.5 }}
        >
          {subtitle}
        </Text>
      </View>
      {!isPartner ? (
        <View className="rounded-full bg-muted px-2 py-0.5">
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
        <ChevronRight size={16} color="#775254" />
      )}
    </>
  );

  const rowClass = `flex-row items-center gap-3 px-3.5 py-3 ${
    first ? '' : 'border-t border-border'
  }`;

  // Non-partners are visible but inert: create-ticket would 409 `not_partner`.
  if (!isPartner) {
    return (
      <View
        accessibilityState={{ disabled: true }}
        className={rowClass}
        style={{ opacity: 0.55 }}
      >
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
