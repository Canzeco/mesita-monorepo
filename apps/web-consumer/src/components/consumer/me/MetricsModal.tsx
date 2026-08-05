"use client";

// Metrics — the Me page's lifetime counters sheet (MESITA-895): everything
// the guest has done on Mesita, as plain numbers. No charts, no time ranges —
// the passport aesthetic carried into analytics: a big tabular number over a
// small-caps label, six tiles, done. Data comes from consumer-web-get-metrics,
// fetched once per page visit when the sheet first opens.

import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  apiFetchConsumerMetrics,
  type ConsumerMetrics,
} from "@/lib/api/profile";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";

const TILES: { key: keyof ConsumerMetrics; label: string }[] = [
  { key: "visits", label: "Visits" },
  { key: "places", label: "Places visited" },
  { key: "reservations", label: "Reservations" },
  { key: "saves", label: "Saved places" },
  { key: "stories", label: "Stories posted" },
  { key: "reviews", label: "Reviews left" },
];

export function MetricsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [metrics, setMetrics] = useState<ConsumerMetrics | null>(null);
  // Render-free latch (a ref, so the effect never sets state synchronously):
  // first open triggers the fetch, reopening reuses the result, an error
  // re-arms it so the next open retries.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!open || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetchConsumerMetrics(supabase);
        if (!cancelled) setMetrics(data);
      } catch (e) {
        if (cancelled) return;
        toast(errMsg(e, "Couldn't load your metrics."));
        requestedRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Metrics">
      <div className="space-y-4 px-5 pt-4 pb-8">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-xl">
            <Activity className="size-[18px]" strokeWidth={2.25} />
          </span>
          <div>
            <h2 className="text-foreground text-lg leading-tight font-bold tracking-tight">
              Metrics
            </h2>
            <p className="text-muted-foreground text-[12px]">
              Your Mesita, in numbers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {TILES.map(({ key, label }) => (
            <div
              key={key}
              className="border-border/60 bg-muted/30 rounded-2xl border px-4 py-3.5"
            >
              {metrics ? (
                <p className="text-foreground text-[22px] leading-none font-extrabold tracking-tight tabular-nums">
                  {metrics[key]}
                </p>
              ) : (
                <div className="bg-muted h-[22px] w-10 animate-pulse rounded-md" />
              )}
              <p className="text-muted-foreground/80 mt-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </LocalSheet>
  );
}
