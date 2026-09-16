"use client";

// A SNAPSHOT of apps/web-business/src/components/place-manage/sections/
// ProfileCompleteness.tsx — the one full-width element above the Profile
// masonry (MESITA-586).
//
// The score is computed ENTIRELY on the client from the already-loaded place:
// deliberately no backend calculation, no column, no EF — just a frontend read
// of the profile object. Because the profile flows through context, the banner
// re-derives live as the form is edited and again when the save lands.
//
// The chips are inert here. In the real console two of them are LINKS through
// `placeSectionHref` — Menu to the Menus view, Reservations to Visits — and
// the rest are same-page scroll targets. Both mechanisms are about a form the
// mock's Profile does not own: there is no Menus editor under this app's
// Profile and no reservation control on it either, so a chip that navigated
// would land somewhere that cannot fix what it names. They stay as the spans
// the real file falls back to.
//
// (That fallback is itself a scar worth keeping: `scrollToSection` bails on a
// null lookup with NO feedback, so when MESITA-1848 moved Menus to its own
// address the Menu chip became a button that did nothing at all, silently, on
// the one card whose entire job is telling an operator what to go and fix.)

import { CheckCircle2, Gauge } from "lucide-react";
import type { MockPlaceProfile } from "@/mock/types";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const CHIP_CLASS =
  "rounded-full border border-foreground/25 px-2 py-0.5 type-meta font-semibold text-foreground";

/** The five channels a place can serve reservations through, `none` included
 *  — picking "no door" is a decision, and the check passes on it. */
const SERVING_CHANNELS = ["phone", "whatsapp", "instagram", "web", "none"];

type CompletenessCheck = {
  label: string;
  /** Chip copy when the item is missing — imperative, actionable. */
  hint: string;
  weight: number;
  done: (p: MockPlaceProfile) => boolean;
  /** Same-page scroll target id — the chip becomes a button that moves the
   *  page to the card that fixes it. ONLY for a section this card's own page
   *  renders: `scrollToSection` bails on a null lookup with no feedback of any
   *  kind, so an id naming an element elsewhere is a chip that does nothing. */
  scrollId?: string;
};

// Weights sum to exactly 100. Photos weigh most — they carry the consumer
// card; the rest are the fields a guest actually reads.
const CHECKS: readonly CompletenessCheck[] = [
  {
    label: "Name",
    hint: "Add the place name",
    weight: 5,
    done: (p) => !!(p.mesita_name ?? p.google_name ?? "").trim(),
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
    done: (p) => p.menus.length > 0,
    // A SCROLL AGAIN, not an inert span (MESITA-1917). This was `scrollId:
    // "place-products"` until MESITA-1848 gave Menus its own address; from
    // that day `getElementById` returned null and the chip did nothing at all,
    // silently, on the one card whose entire job is telling an operator what to
    // go and fix (MESITA-1883). Menus is back on this page, so the id resolves
    // and the chip works — which is the whole reason `MenusSection` still
    // renders `id="place-products"`.
    scrollId: "place-products",
  },
  {
    label: "Reservations",
    hint: "Pick a reservation channel",
    weight: 10,
    done: (p) =>
      typeof p.reservation_channel === "string" &&
      SERVING_CHANNELS.includes(p.reservation_channel),
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

export function ProfileCompleteness({ place }: { place: MockPlaceProfile }) {
  const missing = CHECKS.filter((c) => !c.done(place));
  const pct = 100 - missing.reduce((sum, c) => sum + c.weight, 0);
  const complete = missing.length === 0;
  // Pipeline state lives in place chrome (MESITA-896). When Intaker is mid-
  // flight, a quiet footnote here explains why completeness chips may lag.
  const enriching =
    place.content_state === "generating" || place.content_state === "queued";

  // The band used to be four hues and NOTHING else, so at greyscale 70% and 20%
  // were the same object. The BAR carries the band by width — it always did —
  // and the chip carries the only binary that matters, done or not, with the
  // Gauge/Check glyph swap below.
  const chip = complete
    ? "bg-foreground text-background"
    : "bg-muted text-muted-foreground";

  return (
    <section className="border-border bg-card mb-4 rounded-2xl border p-5 sm:p-6 lg:mb-5">
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
              className="bg-foreground h-full rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {complete ? (
            <p className="flex items-center gap-1.5 type-label text-foreground font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Profile complete — everything a guest needs is filled in.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground type-meta font-semibold tracking-wide uppercase">
                Missing:
              </span>
              {missing.slice(0, 5).map((c) =>
                c.scrollId ? (
                  <button
                    key={c.label}
                    type="button"
                    className={CHIP_CLASS + " underline underline-offset-2 transition hover:bg-muted"}
                    onClick={() => scrollToSection(c.scrollId!)}
                  >
                    {c.hint}
                  </button>
                ) : (
                  <span key={c.label} className={CHIP_CLASS}>
                    {c.hint}
                  </span>
                ),
              )}
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
