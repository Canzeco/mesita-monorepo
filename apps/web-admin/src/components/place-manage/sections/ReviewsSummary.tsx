"use client";

import { useState, type ReactNode } from "react";
import { RefreshCw, Star } from "lucide-react";
import type { AdminPlace, ReviewsReloadSource } from "../actions";
import { reloadPlaceReviews } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { usePlaceContext } from "../PlaceContext";

// Reviews tab (MESITA-2183). Read-only numbers. Each tile reloads from its
// own link and that reload is the only fetch. Enrichment does not own this.

type SourceState = {
  status: "empty" | "ready" | "failed";
  fetched_at: string | null;
  error: string | null;
};

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

function sourceState(raw: unknown, name: ReviewsReloadSource, hasNumber: boolean): SourceState {
  const blob = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[name] : null;
  if (blob && typeof blob === "object") {
    const row = blob as Record<string, unknown>;
    const status = row.status;
    if (status === "empty" || status === "ready" || status === "failed") {
      return {
        status,
        fetched_at: typeof row.fetched_at === "string" ? row.fetched_at : null,
        error: typeof row.error === "string" ? row.error : null,
      };
    }
  }
  return hasNumber
    ? { status: "ready", fetched_at: null, error: null }
    : { status: "empty", fetched_at: null, error: null };
}

function age(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
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

function ReloadButton({
  label,
  armed,
  busy,
  onClick,
}: {
  label: string;
  armed: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!armed || busy}
      onClick={onClick}
      className="border-border text-foreground inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border disabled:cursor-not-allowed disabled:opacity-40"
    >
      <RefreshCw className={"h-4 w-4 " + (busy ? "animate-spin" : "")} />
    </button>
  );
}

export function ReviewsSummary() {
  const { place, setPlace } = usePlaceContext();
  const [busy, setBusy] = useState<ReviewsReloadSource | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function reload(source: ReviewsReloadSource) {
    setBusy(source);
    setNote(null);
    const r = await reloadPlaceReviews(place.id, source);
    setBusy(null);
    if (!r.ok) {
      setNote(r.error);
      return;
    }
    setPlace({
      ...place,
      google_stars_overall: r.data.google_stars_overall,
      google_review_count: r.data.google_review_count,
      instagram_followers_count: r.data.instagram_followers_count,
      facebook_followers: r.data.facebook_followers,
      reviews_state: r.data.reviews_state,
    });
    if (r.data.failed && r.data.error) setNote(r.data.error);
  }

  return (
    <SectionCard
      icon={<Star className="h-4 w-4" />}
      tint="violet"
      title="Reviews"
      subtitle="What guests scored this place, and how many follow it."
    >
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <GoogleTile place={place} busy={busy === "google"} onReload={() => reload("google")} />
        </div>
        <SocialTile
          label="Instagram"
          followers={num(place.instagram_followers_count)}
          linked={!!place.instagram_url?.trim()}
          state={sourceState(place.reviews_state, "instagram", num(place.instagram_followers_count) != null)}
          busy={busy === "instagram"}
          onReload={() => reload("instagram")}
        />
        <SocialTile
          label="Facebook"
          followers={num(place.facebook_followers)}
          linked={!!place.facebook_url?.trim()}
          state={sourceState(place.reviews_state, "facebook", num(place.facebook_followers) != null)}
          busy={busy === "facebook"}
          onReload={() => reload("facebook")}
        />
      </div>
      {note ? <p className="text-destructive mt-3 type-label">{note}</p> : null}
    </SectionCard>
  );
}

function GoogleTile({
  place,
  busy,
  onReload,
}: {
  place: AdminPlace;
  busy: boolean;
  onReload: () => void;
}) {
  const stars = num(place.google_stars_overall);
  const count = num(place.google_review_count);
  const armed = !!place.google_place_id?.trim();
  const state = sourceState(place.reviews_state, "google", stars != null || count != null);
  const show = state.status !== "empty" && (stars != null || count != null);
  const hint = !armed
    ? "This place has no Google place id"
    : state.status === "failed"
    ? (state.error ?? "Couldn't reload. Try again.")
    : !show
    ? "Reload to fetch the score."
    : count != null && count > 0
    ? `${reviewWord(count)} · ${age(state.fetched_at) ?? "on file"}`
    : (age(state.fetched_at) ? `updated ${age(state.fetched_at)}` : "on file");
  return (
    <Tile
      label="Google"
      value={!show || stars == null ? "—" : stars.toFixed(1)}
      muted={!show || stars == null}
      stars={show && stars != null ? stars : null}
      hint={hint}
      reload={
        <ReloadButton label="Reload Google reviews" armed={armed} busy={busy} onClick={onReload} />
      }
    />
  );
}

function SocialTile({
  label,
  followers,
  linked,
  state,
  busy,
  onReload,
}: {
  label: string;
  followers: number | null;
  linked: boolean;
  state: SourceState;
  busy: boolean;
  onReload: () => void;
}) {
  const showNumber = state.status !== "empty" && followers != null;
  const hint = !linked
    ? `Add a ${label} link on Profile`
    : state.status === "failed"
    ? (state.error ?? "Couldn't reload. Try again.")
    : !showNumber
    ? "Saved link. Reload to fetch followers."
    : `followers · ${age(state.fetched_at) ?? "on file"}`;
  return (
    <Tile
      label={label}
      value={showNumber ? compact(followers!) : "—"}
      muted={!showNumber}
      hint={hint}
      reload={
        <ReloadButton
          label={`Reload ${label} followers`}
          armed={linked}
          busy={busy}
          onClick={onReload}
        />
      }
    />
  );
}

function Tile({
  label,
  value,
  muted,
  stars,
  hint,
  reload,
}: {
  label: string;
  value: string;
  muted: boolean;
  stars?: number | null;
  hint: string;
  reload: ReactNode;
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
      </div>
      {reload}
    </div>
  );
}
