"use client";

import { CheckCircle2, Gauge } from "lucide-react";
import type { AdminPlace } from "../actions";

// Profile completeness banner (MESITA-586) — the one full-width element above
// the Place-tab masonry. The score is computed ENTIRELY on the client from
// the already-loaded AdminPlace: deliberately NO backend calculation, no
// column, no EF — just a frontend read of the profile object. Because the
// place flows through UnitPlaceContext, the banner re-derives live as each
// section saves.

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

type CompletenessCheck = {
  label: string;
  // Chip copy when the item is missing — imperative, actionable.
  hint: string;
  weight: number;
  done: (p: AdminPlace) => boolean;
};

// Weights sum to exactly 100. Photos weigh most — they carry the consumer
// card; the rest are the fields a guest (or the recommender) actually reads.
const CHECKS: readonly CompletenessCheck[] = [
  {
    label: "Name",
    hint: "Add the place name",
    weight: 5,
    done: (p) => !!p.name?.trim(),
  },
  {
    label: "Category",
    hint: "Pick a category",
    weight: 10,
    done: (p) => !!p.category,
  },
  {
    label: "About",
    hint: "Write the About (80+ characters)",
    weight: 10,
    done: (p) => (p.description ?? "").trim().length >= 80,
  },
  {
    label: "Photos",
    hint: "Add at least 3 photos",
    weight: 15,
    done: (p) => (p.photos?.length ?? 0) >= 3,
  },
  {
    label: "Hours",
    hint: "Set opening hours",
    weight: 10,
    done: (p) =>
      !!p.hours &&
      Object.values(p.hours).some((d) => Array.isArray(d) && d.length > 0),
  },
  {
    label: "Contact",
    hint: "Add a phone or WhatsApp",
    weight: 10,
    done: (p) => !!(p.phone || p.whatsapp_url),
  },
  {
    label: "Web presence",
    hint: "Link a website or Instagram",
    weight: 10,
    done: (p) => !!(p.website_url || p.instagram_url),
  },
  {
    label: "Menu",
    hint: "Add a menu",
    weight: 10,
    done: (p) =>
      (p.products?.menu?.length ?? 0) > 0 ||
      (p.menus?.length ?? 0) > 0 ||
      !!p.menu_pdf_url,
  },
  {
    label: "Reservations",
    hint: "Pick a reservation channel",
    weight: 10,
    done: (p) => !!p.products?.reservations?.channel,
  },
  {
    label: "Tags",
    hint: "Pick at least 3 tags",
    weight: 10,
    done: (p) => (p.tags?.length ?? 0) >= 3,
  },
];

const MAX_MISSING_CHIPS = 5;

export function ProfileCompleteness({ place }: { place: AdminPlace }) {
  const missing = CHECKS.filter((c) => !c.done(place));
  const pct = 100 - missing.reduce((sum, c) => sum + c.weight, 0);
  const complete = missing.length === 0;

  // Chip hue tracks the band so the banner reads at a glance.
  const chip = complete
    ? "bg-emerald-500/10 text-emerald-600"
    : pct >= 70
      ? "bg-sky-500/10 text-sky-600"
      : pct >= 40
        ? "bg-amber-500/10 text-amber-600"
        : "bg-rose-500/10 text-rose-600";

  return (
    <section className="border-border bg-card shadow-card mb-4 rounded-2xl border p-5 sm:p-6 lg:mb-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex items-center gap-3">
          <span
            className={cx(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              chip,
            )}
          >
            {complete ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Gauge className="h-4 w-4" />
            )}
          </span>
          <div>
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
              Profile completeness
            </p>
            <p className="font-display text-2xl leading-none font-bold tabular-nums">
              {pct}%
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
          <div
            className="bg-muted h-2 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completeness"
          >
            <div
              className="bg-pink-gradient h-full rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {complete ? (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Profile complete — everything a guest needs is filled in.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Missing:
              </span>
              {missing.slice(0, MAX_MISSING_CHIPS).map((c) => (
                <span
                  key={c.label}
                  className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                >
                  {c.hint}
                </span>
              ))}
              {missing.length > MAX_MISSING_CHIPS && (
                <span className="text-muted-foreground text-[10px]">
                  +{missing.length - MAX_MISSING_CHIPS} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
