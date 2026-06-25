import {
  BadgeCheck,
  Facebook,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { GoogleLogo, InstagramLogo, Section } from "@/components/shared";
import type { MyVenue } from "@/lib/api/venues";
import { cn } from "@/lib/utils";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";

export function VenueReviewsPanel({ venue }: { venue: MyVenue }) {
  return (
    <div className="flex flex-col gap-4">
      <ReviewsSummarySection venue={venue} />
      <RelevantReviewsSection venue={venue} />
    </div>
  );
}

function ReviewsSummarySection({ venue }: { venue: MyVenue }) {
  const externalMetrics: {
    label: string;
    value: string | null;
    meta: string;
    icon: "star" | "users";
    logo: React.ReactNode;
  }[] = [
    {
      label: "Google",
      value:
        venue.google_stars_overall == null
          ? null
          : venue.google_stars_overall.toFixed(1),
      meta:
        venue.google_review_count == null
          ? "reviews"
          : `${formatCount(venue.google_review_count)} reviews`,
      icon: "star",
      logo: <GoogleLogo size={12} />,
    },
    {
      label: "Instagram",
      value:
        venue.instagram_followers_count == null
          ? null
          : formatCount(venue.instagram_followers_count),
      meta: "followers",
      icon: "users",
      logo: <InstagramLogo size={12} />,
    },
    {
      label: "Facebook",
      value: null,
      meta: "followers",
      icon: "users",
      logo: <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />,
    },
  ];

  const overallMesita = venue.mesita_stars_overall ?? 5;
  const overallCount = venue.mesita_review_count ?? 0;
  const bars = [
    ["Overall", overallMesita],
    ["Food", venue.mesita_stars_food ?? 5],
    ["Service", venue.mesita_stars_service ?? 5],
    ["Ambience", venue.mesita_stars_ambience ?? 5],
    ["Value", overallMesita],
  ] as const;

  return (
    <Section
      title="Reviews summary"
      right={<span className={TINY_LABEL_CLASS}>Read-only</span>}
      className="rounded-xl border-border/60 shadow-none"
    >
      <div className="bg-background border-border flex flex-col gap-4 rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-pink-500" />
          <p className="text-sm font-semibold">Mesita</p>
          <span className="text-muted-foreground ml-auto text-[11px]">
            {overallCount} reviews
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/30">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-2xl leading-none font-semibold">
                {overallMesita.toFixed(1)}
              </span>
              <Star
                className="h-3 w-3 fill-amber-400 text-amber-400"
                strokeWidth={0}
              />
            </div>
            <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
              Overall
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {bars.map(([label, value]) => (
              <RatingBar key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {externalMetrics.map((m) => (
          <ExternalMetricCard
            key={m.label}
            logo={m.logo}
            icon={m.icon}
            value={m.value}
            meta={m.meta}
            label={m.label}
          />
        ))}
      </div>
    </Section>
  );
}

function RelevantReviewsSection({ venue }: { venue: MyVenue }) {
  const items = extractRelevantReviews(venue);
  return (
    <Section
      title="Relevant reviews"
      right={<span className={TINY_LABEL_CLASS}>{items.length} shown</span>}
      className="rounded-xl border-border/60 shadow-none"
    >
      {items.length === 0 ? (
        <p className="bg-muted text-muted-foreground rounded-xl px-3 py-3 text-xs">
          No review snippets available yet for this venue.
        </p>
      ) : (
        <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
          {items.map((item) => (
            <article
              key={item.id}
              className="bg-background border-border w-[280px] shrink-0 snap-start rounded-xl border p-3 sm:w-[320px]"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{item.author}</p>
                <ReviewSourceBadge source={item.source} />
              </div>
              <div className="mb-2 flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3.5 w-3.5",
                      i < item.rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/35",
                    )}
                    strokeWidth={0}
                  />
                ))}
              </div>
              <div className="bg-muted/20 mt-2 max-h-44 min-h-36 scrollbar-thin overflow-y-auto rounded-lg p-2.5">
                <p className="text-muted-foreground text-[13px] leading-snug">
                  &ldquo;{item.text}&rdquo;
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}

function ReviewSourceBadge({ source }: { source: "Mesita" | "Google" }) {
  const isGoogle = source === "Google";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        isGoogle
          ? "bg-blue-500/10 text-blue-700"
          : "bg-pink-500/10 text-pink-700",
      )}
    >
      {isGoogle ? <GoogleLogo size={10} /> : <Sparkles className="h-3 w-3" />}
      {isGoogle ? "From Google" : "From Mesita"}
    </span>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-14 shrink-0 truncate text-[11px]">
        {label}
      </span>
      <div className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-pink-gradient absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function ExternalMetricCard({
  logo,
  icon,
  value,
  meta,
  label,
}: {
  logo: React.ReactNode;
  icon: "star" | "users";
  value: string | null;
  meta: string;
  label: string;
}) {
  return (
    <div className="bg-background border-border flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3">
      <div className="mb-1">{logo}</div>
      <div className="flex items-center gap-1 text-sm font-semibold">
        {icon === "star" ? (
          <Star
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
            strokeWidth={0}
          />
        ) : (
          <Users className="text-muted-foreground h-3.5 w-3.5" />
        )}
        {value ?? "Not found"}
      </div>
      <p className="text-muted-foreground text-[10px] leading-tight">
        {value == null ? "Not found yet" : meta}
      </p>
      <p className="text-muted-foreground text-[10px] leading-tight">{label}</p>
    </div>
  );
}

function extractRelevantReviews(venue: MyVenue): Array<{
  id: string;
  source: "Mesita" | "Google";
  author: string;
  rating: number;
  text: string;
}> {
  const raw = venue as unknown as Record<string, unknown>;
  const out: Array<{
    id: string;
    source: "Mesita" | "Google";
    author: string;
    rating: number;
    text: string;
  }> = [];

  const mesita = toReviewItems(raw["mesita_visitors"], "Mesita");
  const google = toReviewItems(raw["google_reviews"], "Google");
  const max = Math.max(mesita.length, google.length);
  for (let i = 0; i < max; i += 1) {
    if (mesita[i]) out.push(mesita[i]);
    if (google[i]) out.push(google[i]);
  }
  return out;
}

function toReviewItems(
  input: unknown,
  source: "Mesita" | "Google",
): Array<{
  id: string;
  source: "Mesita" | "Google";
  author: string;
  rating: number;
  text: string;
}> {
  if (!Array.isArray(input)) return [];
  const items: Array<{
    id: string;
    source: "Mesita" | "Google";
    author: string;
    rating: number;
    text: string;
  }> = [];

  input.forEach((rawItem, idx) => {
    if (!rawItem || typeof rawItem !== "object") return;
    const row = rawItem as Record<string, unknown>;
    const author = firstNonEmptyString([
      row["author"],
      row["author_name"],
      row["name"],
      row["user_name"],
      row["username"],
    ]);
    const text = firstNonEmptyString([
      row["text"],
      row["review"],
      row["body"],
      row["comment"],
      row["quote"],
    ]);
    const rating = normalizeRating(row["rating"]);
    if (!text) return;
    items.push({
      id: `${source.toLowerCase()}-${idx}-${author ?? "guest"}`,
      source,
      author: author ?? "Guest",
      rating,
      text,
    });
  });

  return items;
}

function firstNonEmptyString(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeRating(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(5, Math.max(1, Math.round(v)));
  }
  if (typeof v === "string") {
    const num = Number.parseFloat(v);
    if (Number.isFinite(num)) return Math.min(5, Math.max(1, Math.round(num)));
  }
  return 5;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
