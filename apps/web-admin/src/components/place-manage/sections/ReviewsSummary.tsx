"use client";

import { useState, type ReactNode } from "react";
import { RefreshCw, Star } from "lucide-react";
import type { AdminPlace } from "../actions";
import { reloadPlaceReviews } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { mergeReviewFoundFlags } from "@/lib/review-found";
import { usePlaceContext } from "../PlaceContext";

// Reviews. One Sync in the header updates the four boxes from saved links.
// Save on Profile does not call this. Found flags are not profile fields.

type BoxState = "no-link" | "never-synced" | "syncing" | "synced" | "error";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function compact(n: number): string {
  if (n < 1_000) return n.toLocaleString();
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000).toFixed(1)}K`;
}

function reviewWord(n: number): string {
  return `${compact(n)} review${n === 1 ? "" : "s"}`;
}

export function syncSubtitle(input: {
  syncedAt: string | null;
  failures: string[];
  syncing: boolean;
}): string {
  if (input.syncing) return "Syncing…";
  if (input.failures.length > 0) return `${input.failures.join(", ")} failed.`;
  if (!input.syncedAt) return "Never synced";
  return `Synced ${relative(input.syncedAt)}`;
}

function relative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "just now";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} h ago`;
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(Math.min(Math.max(value, 0), 5));
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={
            "h-3 w-3 " +
            (i < filled
              ? "fill-foreground text-muted-foreground"
              : "text-muted-foreground/30")
          }
        />
      ))}
    </span>
  );
}

export function ReviewsSummary() {
  const { place, setPlace } = usePlaceContext();
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [box, setBox] = useState<Record<string, BoxState>>({});

  async function sync() {
    setSyncing(true);
    setFailures([]);
    setBox({
      google: place.google_place_id?.trim() ? "syncing" : "no-link",
      instagram: place.instagram_url?.trim() ? "syncing" : "no-link",
      facebook: place.facebook_url?.trim() ? "syncing" : "no-link",
      google_reviews: place.google_place_id?.trim() ? "syncing" : "no-link",
    });
    const r = await reloadPlaceReviews(place.id, "sync");
    setSyncing(false);
    if (!r.ok) {
      setFailures(["Sync"]);
      return;
    }
    const sources = r.data.sources ?? [];
    const next: Record<string, BoxState> = {};
    const failed: string[] = [];
    for (const row of sources) {
      next[row.source] = row.status === "no_link"
        ? "no-link"
        : row.status === "error"
        ? "error"
        : "synced";
      if (row.status === "error") failed.push(row.source);
    }
    setBox(next);
    setFailures(failed);
    setSyncedAt(r.data.lastSyncedAt ?? new Date().toISOString());
    setPlace((current) => ({
      ...current,
      google_stars_overall: r.data.google_stars_overall,
      google_review_count: r.data.google_review_count,
      instagram_followers_count: r.data.instagram_followers_count,
      facebook_followers: r.data.facebook_followers,
      ...mergeReviewFoundFlags(current, r.data),
      google_reviews: r.data.google_reviews ?? current.google_reviews,
      source_sync: r.data.source_sync ?? current.source_sync,
    }));
  }

  const stored = storedSync(place.source_sync);
  const googleState = box.google ?? reviewBoxState(!!place.google_place_id?.trim(), stored.google);
  const igState = box.instagram ?? reviewBoxState(!!place.instagram_url?.trim(), stored.instagram);
  const fbState = box.facebook ?? reviewBoxState(!!place.facebook_url?.trim(), stored.facebook);
  const reviewsState = box.google_reviews ?? reviewBoxState(!!place.google_place_id?.trim(), stored.google_reviews);
  const shownAt = syncedAt ?? stored.lastSyncedAt;

  return (
    <SectionCard
      icon={<Star className="h-4 w-4" />}
      tint="violet"
      title="Reviews"
      subtitle={syncSubtitle({ syncedAt: shownAt, failures, syncing })}
      action={
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={"h-3.5 w-3.5 " + (syncing ? "animate-spin" : "")} />
          Sync
        </button>
      }
    >
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SummaryTile
            label="Google Summary"
            state={googleState}
            value={num(place.google_stars_overall) == null ? "—" : num(place.google_stars_overall)!.toFixed(1)}
            muted={num(place.google_stars_overall) == null}
            stars={num(place.google_stars_overall)}
            hint={hintFor(googleState, num(place.google_review_count) != null ? reviewWord(num(place.google_review_count)!) : "No rating yet.")}
          />
        </div>
        <SummaryTile
          label="Instagram Summary"
          state={igState}
          value={num(place.instagram_followers_count) == null ? "—" : compact(num(place.instagram_followers_count)!)}
          muted={num(place.instagram_followers_count) == null}
          hint={hintFor(igState, "followers")}
        />
        <SummaryTile
          label="Facebook Summary"
          state={fbState}
          value={num(place.facebook_followers) == null ? "—" : compact(num(place.facebook_followers)!)}
          muted={num(place.facebook_followers) == null}
          hint={hintFor(fbState, "followers")}
        />
        <div className="sm:col-span-2">
          <ReviewsTile place={place} state={reviewsState} />
        </div>
      </div>
    </SectionCard>
  );
}

function hintFor(state: BoxState, detail: string): string {
  if (state === "no-link") return "No link";
  if (state === "syncing") return "Syncing";
  if (state === "error") return "Error";
  if (state === "synced") return `Synced · ${detail}`;
  return `Never synced · ${detail}`;
}

export function reviewBoxState(armed: boolean, status: string | undefined): BoxState {
  if (!armed) return "no-link";
  if (status === "error") return "error";
  if (status === "synced") return "synced";
  return "never-synced";
}

function storedSync(raw: unknown): {
  lastSyncedAt: string | null;
  google?: string;
  instagram?: string;
  facebook?: string;
  google_reviews?: string;
} {
  if (!raw || typeof raw !== "object") return { lastSyncedAt: null };
  const body = raw as { lastSyncedAt?: unknown; sources?: { source?: string; status?: string }[] };
  const out: ReturnType<typeof storedSync> = {
    lastSyncedAt: typeof body.lastSyncedAt === "string" ? body.lastSyncedAt : null,
  };
  for (const row of body.sources ?? []) {
    if (row.source === "google" || row.source === "instagram" || row.source === "facebook" || row.source === "google_reviews") {
      out[row.source] = row.status;
    }
  }
  return out;
}

function storedReviews(raw: unknown): { author: string; quote: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { author: string; quote: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const quote = typeof row.quote === "string"
      ? row.quote.trim()
      : typeof row.text === "string"
      ? row.text.trim()
      : "";
    if (!quote) continue;
    const author = typeof row.author === "string" && row.author.trim()
      ? row.author.trim()
      : "Google reviewer";
    out.push({ author, quote });
  }
  return out;
}

function ReviewsTile({ place, state }: { place: AdminPlace; state: BoxState }) {
  const reviews = storedReviews(place.google_reviews);
  const shown = reviews.slice(0, 3);
  return (
    <Tile
      label="Google Reviews"
      state={state}
      value={reviews.length > 0 ? String(reviews.length) : "—"}
      muted={reviews.length === 0}
      hint={hintFor(state, reviews.length > 0 ? "on file" : "No reviews on file.")}
      extra={shown.length > 0 ? (
        <ul className="text-muted-foreground mt-1 space-y-1 type-label">
          {shown.map((review, i) => (
            <li key={i} className="truncate">{review.author}: {review.quote}</li>
          ))}
          {reviews.length > shown.length ? <li>+{reviews.length - shown.length} more</li> : null}
        </ul>
      ) : null}
    />
  );
}

function SummaryTile({
  label,
  state,
  value,
  muted,
  stars,
  hint,
}: {
  label: string;
  state: BoxState;
  value: string;
  muted: boolean;
  stars?: number | null;
  hint: string;
}) {
  return (
    <Tile label={label} state={state} value={value} muted={muted} stars={stars} hint={hint} />
  );
}

function Tile({
  label,
  state,
  value,
  muted,
  stars,
  hint,
  extra,
}: {
  label: string;
  state: BoxState;
  value: string;
  muted: boolean;
  stars?: number | null;
  hint: string;
  extra?: ReactNode;
}) {
  return (
    <div className="border-border/60 bg-muted/40 flex min-w-0 items-center gap-3 rounded-xl border px-3.5 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-muted-foreground type-label">{label}</p>
        <p className="flex items-center gap-2">
          <span
            className={
              "text-2xl leading-none font-semibold tracking-tight tabular-nums " +
              (muted ? "text-muted-foreground" : "text-foreground")
            }
          >
            {value}
          </span>
          {stars != null ? <Stars value={stars} /> : null}
        </p>
        <p className="text-muted-foreground type-label">{hint}</p>
        {extra}
      </div>
      <span className="text-muted-foreground type-label capitalize">{state.replace("-", " ")}</span>
    </div>
  );
}
