"use client";

import { ExternalLink, Star } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Spinner } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  getPlaceReviews,
  type MesitaPlaceReview,
} from "../actions";

const PAGE_SIZE = 20;

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

function SubScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground type-label">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value == null ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}

function ReviewRow({ review }: { review: MesitaPlaceReview }) {
  const overall =
    review.overall ??
    Math.round((review.food + review.service + review.ambience) / 3 * 10) / 10;
  const value =
    review.value ??
    Math.round((review.food + review.service + review.ambience) / 3 * 10) / 10;
  const text = (review.comments ?? "").trim();

  return (
    <article
      className="border-border flex flex-col gap-3 border-t py-4 first:border-t-0"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{review.guestName}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatShortDate(review.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">
            {overall.toFixed(1)}
          </span>
          <Stars value={overall} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SubScore label="Food" value={review.food} />
        <SubScore label="Service" value={review.service} />
        <SubScore label="Ambience" value={review.ambience} />
        <SubScore label="Value" value={value} />
      </div>

      {text ? (
        <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
      ) : (
        <p className="text-muted-foreground text-sm italic">No written comment.</p>
      )}

      {review.visitUrl ? (
        <a
          href={review.visitUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline"
        >
          View visit
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : null}
    </article>
  );
}

export function MesitaReviewsList({ placeId }: { placeId: string }) {
  const [reviews, setReviews] = useState<MesitaPlaceReview[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();

  // Shell remounts via key={place.id} on ReviewsTab — no sync reset here
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    let alive = true;
    getPlaceReviews(placeId, { limit: PAGE_SIZE, offset: 0 }).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setTotal(r.data.total);
      setReviews(r.data.reviews);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [placeId]);

  const loadMore = useCallback(() => {
    setMoreError(null);
    const offset = reviews.length;
    start(() => {
      void getPlaceReviews(placeId, { limit: PAGE_SIZE, offset }).then((r) => {
        if (!r.ok) {
          setMoreError(r.error);
          return;
        }
        setMoreError(null);
        setTotal(r.data.total);
        setReviews((prev) => [...prev, ...r.data.reviews]);
      });
    });
  }, [placeId, reviews.length]);

  if (error && !loaded) {
    return (
      <ErrorNote message="Couldn't load Mesita reviews. Reload to try again." />
    );
  }

  if (!loaded && reviews.length === 0) {
    return <Spinner label="Loading reviews…" />;
  }

  if (total === 0) {
    return (
      <EmptyState
        icon={<Star className="text-muted-foreground h-6 w-6" />}
        title="No Mesita reviews yet"
        description="Guest reviews appear here after they rate a visit through Mesita."
      />
    );
  }

  const hasMore = reviews.length < total;

  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold tracking-tight">
        Mesita guest reviews
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Individual ratings from Mesita guests. Google reviews stay on Google.
      </p>

      <div className="mt-4">
        {reviews.map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Showing {reviews.length} of {total} · newest first
        </p>
        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="text-sm font-medium underline-offset-2 hover:underline disabled:opacity-50"
          >
            {pending ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </div>
      {moreError ? (
        <ErrorNote message="Couldn't load more reviews. Try again." />
      ) : null}
    </section>
  );
}
