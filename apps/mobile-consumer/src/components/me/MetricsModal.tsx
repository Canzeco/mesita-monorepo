// Metrics — the Me screen's lifetime counters sheet (MESITA-895), mobile
// mirror of web MetricsModal: everything the guest has done on Mesita, as
// plain numbers. No charts, no time ranges — the passport aesthetic carried
// into analytics: a big tabular number over a small-caps label, six tiles.
// Data comes from consumer-web-get-metrics, fetched once per screen visit
// when the sheet first opens.

import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import {
  apiFetchConsumerMetrics,
  type ConsumerMetrics,
} from '@/lib/api/auth';

const TILES: { key: keyof ConsumerMetrics; label: string }[] = [
  { key: 'visits', label: 'Visits' },
  { key: 'places', label: 'Places visited' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'saves', label: 'Saved places' },
  { key: 'stories', label: 'Stories posted' },
  { key: 'reviews', label: 'Reviews left' },
];

export function MetricsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [metrics, setMetrics] = useState<ConsumerMetrics | null>(null);
  // Render-free latch (a ref, so the effect never sets state synchronously):
  // first open triggers the fetch, reopening reuses the result, an error
  // re-arms it so the next open retries.
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
          {TILES.map(({ key, label }) => (
            <View
              key={key}
              className="mb-2.5 w-[48.5%] rounded-2xl border border-border/60 bg-muted/30 px-4 py-3.5"
            >
              {metrics ? (
                <Text
                  className="font-extrabold text-foreground"
                  style={{ fontSize: 22, lineHeight: 24, fontVariant: ['tabular-nums'] }}
                >
                  {metrics[key]}
                </Text>
              ) : (
                <View className="h-6 w-10 rounded-md bg-muted" />
              )}
              <Text
                className="mt-1.5 font-semibold uppercase text-muted-foreground/80"
                style={{ fontSize: 10, letterSpacing: 1.2 }}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </FullScreenSheet>
  );
}
