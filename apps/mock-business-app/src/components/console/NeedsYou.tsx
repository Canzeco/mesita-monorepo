"use client";

// WHAT NEEDS YOU, AND WHAT IS OPEN RIGHT NOW (MESITA-1988).
//
// This was the top of the place's Home screen, and Home is gone: Pato took the
// Place tab back to being a switcher — *"place is just to search places and to
// select them and claim it"* — so an Ask bar, four blockers and four counts
// landing there was a dashboard nobody asked the switcher for.
//
// IT MOVED TO ACTIVITY, above the log it was already previewing. "What is
// stopping this place" and "what is open right now" are the same question
// Activity answers; they were only ever on Home because Home existed.
//
// THE RANK IS UNCHANGED (MESITA-1931). The band takes the dock ink and is the
// loudest object; the state is ONE hairline card, blockers as rows and counts
// as a strip, because "what is stopping this place" and "what is open" are one
// question asked twice, and a gap between them said they were not.
import Link from "next/link";
import { AskBar } from "@/components/console/AskBar";
import { placePageHref, placePayHref } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { since } from "@/lib/format";
import {
  GHOST_PILL_BUTTON_CLASS,
  SCOPE_CARD_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import type { MockOrder, MockPlace, MockReservation, MockReview, MockVisit } from "@/mock/types";
import { PAY_LADDER_LABEL, PLAN_LABEL, type PlanTier, planAtLeast } from "@/mock/types";
import { PRODUCT_LABEL } from "@/lib/product-keys";
import { SPECS } from "@/lib/products";

/** What this rung cannot reach, as a sentence — the names in ladder order,
 *  Oxford comma and all, off the same array a product's own card reads for its
 *  floor. A SOON product is not locked: there is nothing behind it to open. */
function lockedProducts(plan: PlanTier): string {
  const names = SPECS.filter(
    (spec) => !spec.soon && !planAtLeast(plan, spec.minPlan),
  ).map((spec) => PRODUCT_LABEL[spec.key]);
  return LIST_FORMAT.format(names);
}

/** `en` and not the viewer's locale, for the same reason the dates in this app
 *  are fixed: a screenshot has to be the same string every time. */
const LIST_FORMAT = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

/** Something stopping this place, and the one screen that unblocks it. */
type Blocker = { label: string; line: string; door: string; href: string };

/** WHAT IS ACTUALLY IN THE WAY, in the order it costs money.
 *
 *  The rung first: it gates whole products, so a place below the one it needs
 *  has several other things wrong that are all the same thing. THE PRODUCTS
 *  ARE NAMED, NEVER COUNTED — "five of the eight" stood here through two
 *  products arriving and one leaving (MESITA-1946) — AND THE NAMES COME OFF
 *  `SPECS` (2026-09-20), because the hand-typed four went stale the moment the
 *  badge moved to Mesita Pro and half the list moved with it. Payments second
 *  — it is the one that stops a guest paying. Then the two that only cost
 *  reach. */
function blockersFor(place: MockPlace, unanswered: number): Blocker[] {
  const out: Blocker[] = [];

  const locked = lockedProducts(place.plan);
  if (locked.length > 0) {
    out.push({
      label: `On ${PLAN_LABEL[place.plan]}`,
      line: `${locked} ${locked.includes(" and ") ? "are" : "is"} locked here, and nothing locked carries a verb until this place is on the rung that opens it.`,
      door: "See what the rungs open",
      href: placePageHref(place.id, "products"),
    });
  } else if (place.pay !== "enabled") {
    out.push({
      label: `Payments · ${PAY_LADDER_LABEL[place.pay]}`,
      line:
        place.pay === "never"
          ? "No Stripe account exists for this place yet, so a guest cannot close a bill in the app."
          : place.pay === "restricted"
            ? "Stripe turned charges off after the fact. Their dashboard says which requirement came due."
            : "Stripe has what it asked for and is still looking at it. Nothing to do but wait.",
      door: place.pay === "pending" ? "Check Payments" : "Finish Payments setup",
      href: placePayHref(place.id),
    });
  }

  if (place.photoCount === 0) {
    out.push({
      label: "No photos",
      line: "Your card in Discovery is the first photo. Without one the place is a name in a list.",
      door: "Add photos",
      href: placeTabHref(place.id, "profile"),
    });
  }

  if (unanswered > 0) {
    out.push({
      label: `${unanswered} review${unanswered === 1 ? "" : "s"} unanswered`,
      line: "A reply is public, and the guests who read it are the ones deciding whether to come.",
      door: "Open Profile",
      href: placeTabHref(place.id, "profile"),
    });
  }

  return out;
}

export function NeedsYou({
  place,
  visits,
  orders,
  reservations,
  reviews,
  now,
}: {
  place: MockPlace;
  visits: readonly MockVisit[];
  orders: readonly MockOrder[];
  reservations: readonly MockReservation[];
  reviews: readonly MockReview[];
  now: Date;
}) {
  const openVisits = visits.filter((v) => v.state === "open");
  const working = orders.filter(
    (o) => o.state === "placed" || o.state === "preparing" || o.state === "ready",
  );
  // AHEAD OF THE FIXED NOW, soonest first. A booking that has been and gone is
  // not "next", and the one this tile means is the one staff are about to seat.
  const upcoming = reservations
    .filter(
      (r) =>
        new Date(r.at).getTime() > now.getTime() &&
        r.state !== "canceled" &&
        r.state !== "no_show",
    )
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const unanswered = reviews.filter((r) => r.reply === null).length;
  const blockers = blockersFor(place, unanswered);

  /** The four counts, each one a thing you can act on today. */
  const counts: { label: string; value: string | number | null; hint?: string }[] = [
    {
      label: "Open visits",
      value: openVisits.length || null,
      hint: openVisits.length ? "Bills still at the table" : undefined,
    },
    {
      label: "Orders to work",
      value: working.length || null,
      hint: working.length ? "Placed, preparing or ready" : undefined,
    },
    {
      label: "Next booking",
      value: upcoming[0] ? since(upcoming[0].at, now) : null,
      hint: upcoming[0] ? `${upcoming[0].guest} · party of ${upcoming[0].party}` : undefined,
    },
    {
      label: "Reviews to answer",
      value: unanswered || null,
      hint: unanswered ? "A reply is public" : undefined,
    },
  ];

  return (
    <>
      <AskBar placeId={place.id} />

      <div className={SCOPE_CARD_CLASS}>
        {blockers.length > 0 ? (
          blockers.map((b) => (
            <div
              key={b.label}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5"
            >
              <span
                className="bg-primary mt-[7px] h-[7px] w-[7px] shrink-0 self-start rounded-full"
                aria-hidden
              />
              <div className="min-w-0 flex-1 basis-64 sm:max-w-[62ch]">
                <p className="text-[13px] font-semibold">{b.label}</p>
                <p className="text-muted-foreground text-[12px] leading-snug">{b.line}</p>
              </div>
              <Link href={b.href} className={GHOST_PILL_BUTTON_CLASS}>
                {b.door}
              </Link>
            </div>
          ))
        ) : (
          <div className="px-4 py-3.5">
            <p className="text-[13px] font-semibold">Nothing is waiting on you</p>
            <p className="text-muted-foreground text-[12px] leading-snug">
              Partner is on, Payments is live, the profile has photos and every review
              has an answer.
            </p>
          </div>
        )}

        {/* THE COUNTS ARE A STRIP, NOT FOUR BOXES. */}
        <dl className="divide-border flex flex-col divide-y sm:flex-row sm:divide-x sm:divide-y-0">
          {counts.map((c) => (
            <div
              key={c.label}
              className="flex flex-1 items-baseline justify-between gap-3 px-4 py-3 sm:block"
            >
              <dt className={TINY_LABEL_CLASS}>{c.label}</dt>
              <dd className="font-display text-xl font-semibold tracking-tight tabular-nums sm:mt-1">
                {/* A DASH, NEVER A ZERO. Zero is a measurement; "we did not
                    read it" is not, and the two must not print the same. */}
                {c.value ?? "—"}
              </dd>
              {c.hint && (
                <dd className="text-muted-foreground hidden text-[11px] leading-snug sm:block">
                  {c.hint}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
