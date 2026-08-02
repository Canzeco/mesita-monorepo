// The New tab (Wallet v3, MESITA-811) — mobile mirror: every Mesita partner,
// listed flat — deliberately no searchbar yet, per Pato ("just list all the
// places; then we see how we solve the searchbar"). Tapping a row opens the
// venue pass modal, which reuses or creates the ticket. Only Verified
// Partners render: the create EF 409s anything else (not_partner).

import { Image } from 'expo-image';
import { ChevronRight, MapPin, Store } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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
          setPlaces(rows.filter((p) => p.listing_type === 'partner'));
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

  if (places.length === 0) {
    return (
      <View className="items-center gap-2 rounded-2xl border border-border bg-card px-4 py-8">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
          <MapPin size={20} color="#775254" />
        </View>
        <Text className="text-muted-foreground" style={{ fontSize: 12.5 }}>
          No partner places yet — check back soon.
        </Text>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      {places.map((p, i) => {
        const hasOpen = activePlaceIds.has(p.id);
        const photo = p.photos?.[0] ?? null;
        const subtitle =
          [p.zone, p.category_label ?? p.category].filter(Boolean).join(' · ') ||
          'Mesita partner';
        return (
          <Pressable
            key={p.id}
            onPress={() => onPick(p)}
            accessibilityRole="button"
            className={`flex-row items-center gap-3 px-3.5 py-3 active:bg-muted/50 ${
              i > 0 ? 'border-t border-border' : ''
            }`}
          >
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={{ width: 48, height: 48, borderRadius: 12 }}
                contentFit="cover"
              />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
                <Store size={20} color="#cf0360" />
              </View>
            )}
            <View className="min-w-0 flex-1">
              <Text
                className="font-bold text-foreground"
                numberOfLines={1}
                style={{ fontSize: 13.5 }}
              >
                {p.name}
              </Text>
              <Text
                className="mt-0.5 text-muted-foreground"
                numberOfLines={1}
                style={{ fontSize: 11.5 }}
              >
                {subtitle}
              </Text>
            </View>
            {hasOpen ? (
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
          </Pressable>
        );
      })}
    </View>
  );
}
