"use client";

// Metrics — Me page lifetime counters (MESITA-904): 10 tiles in funnel →
// value order. Places Visited and Rewards Claimed share one EF source so
// they can never diverge. Money tiles use formatCurrency (MXN).

import { useEffect, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  apiFetchConsumerMetrics,
  formatCurrency,
  type ConsumerMetrics,
} from "@/lib/api/profile";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Tile =
  | { key: keyof ConsumerMetrics; label: string; money?: false }
  | { key: "spent_cents" | "saved_cents"; label: string; money: true };

// decision: funnel then value pair at the end — view → save → visit/claim →
// book → reviews → stories → Total Spent → Total Saved. Money last so the
// activity scan stays clean and the payoff pair reads as a closing beat.
const TILES: Tile[] = [
  { key: "places_viewed", label: "Places viewed" },
  { key: "places_saved", label: "Places saved" },
  { key: "places_visited", label: "Places visited" },
  { key: "rewards_claimed", label: "Rewards claimed" },
  { key: "reservations_booked", label: "Reservations booked" },
  { key: "mesita_reviews", label: "Mesita reviews" },
  { key: "google_reviews", label: "Google reviews" },
  { key: "instagram_stories", label: "Instagram stories" },
  { key: "spent_cents", label: "Total spent", money: true },
  { key: "saved_cents", label: "Total saved", money: true },
];

function formatTileValue(metrics: ConsumerMetrics, tile: Tile): string {
  if (tile.money) return formatCurrency(metrics[tile.key]);
  return String(metrics[tile.key]);
}

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
            <BarChart3 className="size-[18px]" strokeWidth={2.25} />
          </span>
          <div>
            <h2 className="text-foreground text-lg leading-tight font-bold tracking-tight">
              Metrics
            </h2>
            <p className="text-muted-foreground text-xs">
              Your Mesita, in numbers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {TILES.map((tile) => (
            <div
              key={tile.key}
              className="border-border/60 bg-muted/30 rounded-2xl border px-4 py-3.5"
            >
              {metrics ? (
                <p className="text-foreground text-xl leading-none font-extrabold tracking-tight tabular-nums">
                  {formatTileValue(metrics, tile)}
                </p>
              ) : (
                <div className="bg-muted h-[22px] w-14 animate-pulse rounded-md" />
              )}
              <p className="text-muted-foreground/80 type-meta mt-1.5 font-semibold tracking-[0.12em] uppercase">
                {tile.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </LocalSheet>
  );
}
