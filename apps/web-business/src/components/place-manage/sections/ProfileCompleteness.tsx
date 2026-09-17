"use client";

import { CheckCircle2, Gauge } from "lucide-react";
import type { AdminPlace } from "../actions";
import { placeSectionHref } from "../nav";
import { usePlaceContext } from "../PlaceContext";
import { CrossTabLink } from "../ui";
import { isServingChannel } from "./ChannelPicker";

// Profile completeness banner (MESITA-586) — the one full-width element above
// the Place-tab masonry. The score is computed ENTIRELY on the client from
// the already-loaded AdminPlace: deliberately NO backend calculation, no
// column, no EF — just a frontend read of the profile object. Because the
// place flows through PlaceContext, the banner re-derives live as each
// section saves.

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const CHIP_CLASS =
  "rounded-full bg-muted px-2 py-0.5 type-meta font-semibold text-foreground transition hover:bg-muted";

type CompletenessCheck = {
  label: string;
  // Chip copy when the item is missing — imperative, actionable.
  hint: string;
  weight: number;
  done: (p: AdminPlace) => boolean;
  /** Same-page scroll target id — ONLY for a section this card's own page
   *  renders. A scrollId naming an element on another view is a chip that
   *  does nothing, silently: `scrollToSection` below bails on a null lookup
   *  with no feedback of any kind. That is what happened to Menu when
   *  MESITA-1848 moved `MenusSection` to its own address and left the id
   *  behind (MESITA-1883). If the destination is another view, use `tab`. */
  scrollId?: string;
  /** Cross-view section id — the chip becomes a LINK through
   *  `placeSectionHref`, which is the only kind of destination that survives
   *  a view being split out from under it. */
  tab?: "promos";
};

// Weights sum to exactly 100. Photos weigh most — they carry the consumer
// card; the rest are the fields a guest actually reads.
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
    label: "Presentation",
    hint: "Write the Presentation (80+ characters)",
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
    // A SCROLL AGAIN (MESITA-1919), and this is the bug's full arc. It was
    // `scrollId: "place-products"` — the id `MenusSection` renders — until
    // MESITA-1848 gave Menus its own address; from that day the target was on
    // a different page, so the chip called `getElementById`, got null, and
    // returned: a button that did nothing at all, on the one card whose entire
    // job is telling an operator what to go and fix. MESITA-1883 made it a
    // `tab` link to stop the silence. Profile renders `MenusSection` again, so
    // the id resolves on this page and the cheaper answer is correct once more.
    scrollId: "place-products",
  },
  {
    label: "Reservations",
    hint: "Pick a reservation channel",
    weight: 10,
    done: (p) => isServingChannel(p.reservation_channel),
    // Controls — the Reservations rail box has lived there since the rails
    // left Settings (2026-08-30); the chip pointed at the old tab until
    // Partnership and Settings merged into Controls (2026-09-01).
    tab: "promos",
  },
  {
    label: "Tags",
    hint: "Pick at least 3 tags",
    weight: 10,
    done: (p) => (p.tags?.length ?? 0) >= 3,
  },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  if (el instanceof HTMLElement) {
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }
}

export function ProfileCompleteness({ place }: { place: AdminPlace }) {
  const { placeId } = usePlaceContext();
  const missing = CHECKS.filter((c) => !c.done(place));
  const pct = 100 - missing.reduce((sum, c) => sum + c.weight, 0);
  const complete = missing.length === 0;
  // Pipeline state lives in place chrome (MESITA-896). When Intaker is mid-
  // flight, a quiet footnote here explains why completeness chips may lag.
  const enriching =
    place.content_state === "generating" || place.content_state === "queued";

  // Chip hue tracks the band so the banner reads at a glance.
  const chip = complete
    ? "bg-muted text-muted-foreground"
    : pct >= 70
      ? "bg-muted text-muted-foreground"
      : pct >= 40
        ? "bg-muted text-muted-foreground"
        : "bg-muted text-muted-foreground";

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
            <p className="text-muted-foreground type-label font-semibold tracking-[0.12em] uppercase">
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
            <p className="flex items-center gap-1.5 type-label font-semibold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Profile complete — everything a guest needs is filled in.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground type-meta font-semibold tracking-wide uppercase">
                Missing:
              </span>
              {missing.slice(0, 5).map((c) => {
                if (c.scrollId) {
                  return (
                    <button
                      key={c.label}
                      type="button"
                      className={CHIP_CLASS}
                      onClick={() => scrollToSection(c.scrollId!)}
                    >
                      {c.hint}
                    </button>
                  );
                }
                // ANY tab, not just "promos" (MESITA-1883). Hardcoding the one
                // value meant a second cross-view chip silently fell through
                // to the inert `<span>` below instead of linking.
                if (c.tab) {
                  return (
                    <CrossTabLink
                      key={c.label}
                      href={placeSectionHref(placeId, c.tab)}
                      className={CHIP_CLASS + " inline-flex items-center gap-1"}
                    >
                      {c.hint}
                    </CrossTabLink>
                  );
                }
                return (
                  <span key={c.label} className={CHIP_CLASS}>
                    {c.hint}
                  </span>
                );
              })}
              {missing.length > 5 && (
                <span className="text-muted-foreground type-meta">
                  +{missing.length - 5} more
                </span>
              )}
            </div>
          )}
          {enriching ? (
            <p className="text-muted-foreground type-label">
              Intaker is still filling this profile — gaps may close on their own.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
