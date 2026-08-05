// Metrics — Me screen lifetime counters (MESITA-904), mobile mirror of web
// MetricsModal: 10 tiles in funnel → value order. Places Visited and Rewards
// Claimed share one EF source. Money tiles use formatCurrency (MXN).

import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import {
  apiFetchConsumerMetrics,
  type ConsumerMetrics,
} from '@/lib/api/auth';
import { formatCurrency } from '@/lib/api/pay';

type Tile =
  | { key: keyof ConsumerMetrics; label: string; money?: false }
  | { key: 'spent_cents' | 'saved_cents'; label: string; money: true };

// decision: funnel then value pair at the end — view → save → visit/claim →
// book → reviews → stories → Total Spent → Total Saved (web parity).
const TILES: Tile[] = [
  { key: 'places_viewed', label: 'Places viewed' },
  { key: 'places_saved', label: 'Places saved' },
  { key: 'places_visited', label: 'Places visited' },
  { key: 'rewards_claimed', label: 'Rewards claimed' },
  { key: 'reservations_booked', label: 'Reservations booked' },
  { key: 'mesita_reviews', label: 'Mesita reviews' },
  { key: 'google_reviews', label: 'Google reviews' },
  { key: 'instagram_stories', label: 'Instagram stories' },
  { key: 'spent_cents', label: 'Total spent', money: true },
  { key: 'saved_cents', label: 'Total saved', money: true },
];

function formatTileValue(metrics: ConsumerMetrics, tile: Tile): string {
  if (tile.money) return formatCurrency(metrics[tile.key]);
  return String(metrics[tile.key]);
}

export function MetricsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [metrics, setMetrics] = useState<ConsumerMetrics | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!visible || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetchConsumerMetrics();
        if (!cancelled) setMetrics(data);
      } catch {
        if (!cancelled) requestedRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Metrics"
      subtitle="Your Mesita, in numbers"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row flex-wrap justify-between">
          {TILES.map((tile) => (
            <View
              key={tile.key}
              className="mb-2.5 w-[48.5%] rounded-2xl border border-border/60 bg-muted/30 px-4 py-3.5"
            >
              {metrics ? (
                <Text
                  className="font-extrabold text-foreground"
                  style={{
                    fontSize: tile.money ? 18 : 22,
                    lineHeight: tile.money ? 22 : 24,
                    fontVariant: ['tabular-nums'],
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatTileValue(metrics, tile)}
                </Text>
              ) : (
                <View className="h-6 w-14 rounded-md bg-muted" />
              )}
              <Text
                className="mt-1.5 font-semibold uppercase text-muted-foreground/80"
                style={{ fontSize: 10, letterSpacing: 1.2 }}
              >
                {tile.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </FullScreenSheet>
  );
}
