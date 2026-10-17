"use client";

import { useState, type ReactNode } from "react";
import { RefreshCw, Star } from "lucide-react";
import { reloadPlaceReviews } from "../actions";
import { SectionCard, type Tint } from "@/components/admin-ui/manage";
import { mergeReviewFoundFlags } from "@/lib/review-found";
import { usePlaceContext } from "../PlaceContext";

// Reviews. One Sync in the header updates the four boxes from saved links.
// Save on Profile does not call this. Found flags are not profile fields.
// The four boxes are separate cards (Pato, MESITA-2261). Sync stays above them.

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
  errors?: Record<string, string>;
}): string {
  if (input.syncing) return "Syncing…";
  if (input.failures.length > 0) {
    const messages = input.failures
      .map((source) => {
        const raw = input.errors?.[source]?.trim();
        return raw ? formatSyncError(raw) : null;
      })
      .filter((message): message is string => !!message);
    const unique = [...new Set(messages)];
    if (unique.length === 1) return unique[0];
    return `${input.failures.join(", ")} failed.`;
  }
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
  const [sourceErrors, setSourceErrors] = useState<Record<string, string>>({});
  const [box, setBox] = useState<Record<string, BoxState>>({});

  async function sync() {
    setSyncing(true);
    setFailures([]);
    setSourceErrors({});
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
      if (r.error?.trim()) setSourceErrors({ Sync: r.error.trim() });
      setBox((current) => boxesAfterFailedSync(current));
      return;
    }
    const sources = r.data.sources ?? [];
    const next: Record<string, BoxState> = {};
    const failed: string[] = [];
    const errors: Record<string, string> = {};
    for (const row of sources) {
      next[row.source] = row.status === "no_link"
        ? "no-link"
        : row.status === "error"
        ? "error"
        : "synced";
      if (row.status === "error") {
        failed.push(row.source);
        if (row.error?.trim()) errors[row.source] = row.error.trim();
      }
    }
    setBox(next);
    setFailures(failed);
    setSourceErrors(errors);
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
  const errors = { ...stored.errors, ...sourceErrors };
  const googleState = box.google ?? reviewBoxState(!!place.google_place_id?.trim(), stored.google);
  const igState = box.instagram ?? reviewBoxState(!!place.instagram_url?.trim(), stored.instagram);
  const fbState = box.facebook ?? reviewBoxState(!!place.facebook_url?.trim(), stored.facebook);
  const reviewsState = box.google_reviews ?? reviewBoxState(!!place.google_place_id?.trim(), stored.google_reviews);
  const shownAt = syncedAt ?? stored.lastSyncedAt;
  const reviews = storedReviews(place.google_reviews);
  const shown = reviews.slice(0, 3);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-violet-500/10 text-violet-600 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <Star className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight">Reviews</h2>
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">
              {syncSubtitle({ syncedAt: shownAt, failures, syncing, errors })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={"h-3.5 w-3.5 " + (syncing ? "animate-spin" : "")} />
          Sync
        </button>
      </header>
      <ReviewBox
        mark="/channels/google.svg"
        tint="amber"
        title="Google Summary"
        state={googleState}
        hint={hintFor(googleState, num(place.google_review_count) != null ? reviewWord(num(place.google_review_count)!) : "No rating yet.", errors.google, shownAt)}
        value={num(place.google_stars_overall) == null ? "—" : num(place.google_stars_overall)!.toFixed(1)}
        muted={num(place.google_stars_overall) == null}
        stars={num(place.google_stars_overall)}
      />
      <ReviewBox
        mark="/channels/instagram.svg"
        tint="pink"
        title="Instagram Summary"
        state={igState}
        hint={hintFor(igState, "followers", errors.instagram, shownAt)}
        value={num(place.instagram_followers_count) == null ? "—" : compact(num(place.instagram_followers_count)!)}
        muted={num(place.instagram_followers_count) == null}
      />
      <ReviewBox
        mark="/channels/facebook.svg"
        tint="sky"
        title="Facebook Summary"
        state={fbState}
        hint={hintFor(fbState, "followers", errors.facebook, shownAt)}
        value={num(place.facebook_followers) == null ? "—" : compact(num(place.facebook_followers)!)}
        muted={num(place.facebook_followers) == null}
      />
      <ReviewBox
        mark="/channels/google.svg"
        tint="violet"
        title="Google Reviews"
        state={reviewsState}
        hint={hintFor(reviewsState, reviews.length > 0 ? "on file" : "No reviews on file.", errors.google_reviews, shownAt)}
        value={reviews.length > 0 ? String(reviews.length) : "—"}
        muted={reviews.length === 0}
        extra={shown.length > 0 ? (
          <ul className="text-muted-foreground mt-1 space-y-1 type-label">
            {shown.map((review, i) => (
              <li key={i} className="truncate">{review.author}: {review.quote}</li>
            ))}
            {reviews.length > shown.length ? <li>+{reviews.length - shown.length} more</li> : null}
          </ul>
        ) : null}
      />
    </div>
  );
}

function formatSyncError(raw: string): string {
  const text = raw.trim();
  if (/outstanding invoices|platform-feature-disabled/i.test(text)) {
    return "Sync could not run: too many outstanding invoices.";
  }
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export function boxStateLabel(state: BoxState): string {
  if (state === "no-link") return "No link configured";
  if (state === "never-synced") return "Never synced";
  if (state === "syncing") return "Syncing";
  if (state === "error") return "Error";
  return "Synced";
}

function hintFor(state: BoxState, detail: string, error?: string, when?: string | null): string {
  if (state === "no-link") return "No link configured";
  if (state === "syncing") return "Syncing";
  if (state === "error") return error?.trim() ? formatSyncError(error) : "Error";
  if (state === "synced") return when ? `Synced ${relative(when)} · ${detail}` : `Synced · ${detail}`;
  return `Never synced · ${detail}`;
}

/** A failed call never landed a per-source result, so tiles left on Syncing become Error. */
export function boxesAfterFailedSync(box: Record<string, BoxState>): Record<string, BoxState> {
  const next: Record<string, BoxState> = {};
  for (const [key, value] of Object.entries(box)) {
    next[key] = value === "syncing" ? "error" : value;
  }
  return next;
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
  errors: Record<string, string>;
} {
  if (!raw || typeof raw !== "object") return { lastSyncedAt: null, errors: {} };
  const body = raw as {
    lastSyncedAt?: unknown;
    sources?: { source?: string; status?: string; error?: string | null }[];
  };
  const out: ReturnType<typeof storedSync> = {
    lastSyncedAt: typeof body.lastSyncedAt === "string" ? body.lastSyncedAt : null,
    errors: {},
  };
  for (const row of body.sources ?? []) {
    if (row.source === "google" || row.source === "instagram" || row.source === "facebook" || row.source === "google_reviews") {
      out[row.source] = row.status;
      if (row.status === "error" && row.error?.trim()) {
        out.errors[row.source] = row.error.trim();
      }
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

function ReviewBox({
  mark,
  tint,
  title,
  state,
  hint,
  value,
  muted,
  stars,
  extra,
}: {
  mark: string;
  tint: Tint;
  title: string;
  state: BoxState;
  hint: string;
  value: string;
  muted: boolean;
  stars?: number | null;
  extra?: ReactNode;
}) {
  return (
    <SectionCard
      icon={
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mark} alt="" aria-hidden className="h-4 w-4" />
      }
      tint={tint}
      title={title}
      subtitle={hint}
      action={<span className="text-muted-foreground type-label">{boxStateLabel(state)}</span>}
    >
      <div className="mt-5 flex min-w-0 flex-col gap-1.5">
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
        {extra}
      </div>
    </SectionCard>
  );
}
