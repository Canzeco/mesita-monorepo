"use client";

// HOME — the place's bare address, and the screen the console opens on.
//
// It used to be a 307 onto Profile (MESITA-1914 ended that). An operator's
// first screen was therefore a FORM: thirty fields about who you are, offered
// to somebody who came here to find out what happened last night. The rail
// opened on Settings for the same reason — there was nothing above it.
//
// ── WHAT HOME IS FOR ───────────────────────────────────────────────────────
//
// Three bands, in the order an operator needs them:
//
//   THE BAR      say what you want changed; it opens the screen that holds it
//   NEEDS YOU    the things that are stopping money, each with its door
//   TODAY        what is open right now, and the last few things that happened
//
// NOTHING HERE IS A NUMBER FOR ITS OWN SAKE. Every count is something you can
// act on — open visits, orders to work, the next booking, reviews waiting on a
// reply. "Guests all time" would be a fact about the past that no button on
// this page can change, and a Home made of those is a Home nobody opens twice.
//
// ── THE RANK (MESITA-1931) ─────────────────────────────────────────────────
//
// This shipped as FOUR CARDS of one rank — bar, Needs you, four tiles, the log
// — same radius, same border, same fill, same gap. Pato: *"MAKE A BETTER
// DESIGN WHAT THE FUCK IS THAT"*. He was right, and the diagnosis is one word:
// nothing was first. Worse, the loudest objects on the page were four display
// numerals, which are the least actionable thing on it.
//
// Three ranks now, loud to quiet:
//
//   THE BAND   the dock ink, the only dark object on a pink page
//   THE STATE  ONE hairline card — blockers as rows, the counts as a strip
//   THE LOG    last, and the quietest
//
// THE STATE IS ONE CARD BECAUSE IT IS ONE QUESTION. "What is stopping this
// place" and "what is open right now" were a card and a tile row, asked twice
// with a gap between them; hairlines say those rows are related, and the gap
// said they were not. It is the `/account` pattern (MESITA-1840) — and the
// four tiles were four bordered boxes each holding one character.
//
// ── THE ONE THING IT STILL RESOLVES ────────────────────────────────────────
//
// `?connect=…` — Stripe stores an Account Link's `return_url` at the moment the
// link is MINTED, so an owner can come back to this address weeks later, having
// just spent eight minutes uploading documents. That query still hands off to
// Payments setup. Home is what the address means WITHOUT it; the hand-off is
// what it means with it, and the two never collide because Stripe always sends
// the parameter.
import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AskBar } from "@/components/console/AskBar";
import { NotHeld, useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { Badge } from "@/components/shared/Badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { Section } from "@/components/shared/Section";
import { placePageHref, placePayHref } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { money, since } from "@/lib/format";
import {
  GHOST_PILL_BUTTON_CLASS,
  SCOPE_CARD_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { ORDERS, RESERVATIONS, REVIEWS, VISITS } from "@/mock/fixtures";
import { buildLedgers, LOG_LABEL } from "@/mock/logs";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { PAY_LADDER_LABEL, type MockPlace } from "@/mock/types";

/** Something stopping this place, and the one screen that unblocks it. */
type Blocker = { label: string; line: string; door: string; href: string };

/** WHAT IS ACTUALLY IN THE WAY, in the order it costs money.
 *
 *  Partner first: it gates five of the eight products, so a place without it
 *  has four other things wrong that are all the same thing. Payments second —
 *  it is the one that stops a guest paying. Then the two that only cost reach. */
function blockersFor(place: MockPlace, unanswered: number): Blocker[] {
  const out: Blocker[] = [];

  if (!place.partnered) {
    out.push({
      label: "Not a partner",
      line: "Five of the eight products are locked here, and none of them carry a verb until Mesita Partner is on.",
      door: "See the catalogue",
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
      // PROFILE, not Reviews (MESITA-1917): Reviews is a card there now, and a
      // door naming an address that no longer exists is the 404 a union type
      // is the only thing standing between you and.
      door: "Open Profile",
      href: placeTabHref(place.id, "profile"),
    });
  }

  return out;
}

export default function PlaceHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const connect = search.get("connect");
  const place = useHeldPlaceOrNull();
  const { scenario, now } = useMock();

  useEffect(() => {
    if (connect) {
      router.replace(`${placePayHref(id)}?connect=${encodeURIComponent(connect)}`);
    }
  }, [id, connect, router]);

  if (connect) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Opening…
      </p>
    );
  }

  // THE GATE THE PAGES UNDER A PLACE ALL NEED. This one is `[id]` itself, so no
  // tab gate has run at all: a pool id typed into the bar, or the panel flipped
  // to a failed read while Home was open, reaches here with no place.
  if (!place) return <NotHeld />;

  const visits = listFor(VISITS.filter((v) => v.placeId === place.id), scenario);
  const orders = listFor(ORDERS.filter((o) => o.placeId === place.id), scenario);
  const reservations = listFor(
    RESERVATIONS.filter((r) => r.placeId === place.id),
    scenario,
  );
  const reviews = listFor(REVIEWS.filter((r) => r.placeId === place.id), scenario);
  // THE SAME ROWS THE ACTIVITY PAGE SHOWS, and five of them (MESITA-1939).
  // Home used to read its own `ACTIVITY` fixture, which meant the five lines
  // here and the tables one click away were two unrelated inventions about one
  // place. `everything` is the union of the nine logs, so this strip is now a
  // literal preview of the page its heading links to.
  const events = buildLedgers(place, scenario, now).everything.slice(0, 5);

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

      {/* THE STATE OF THE PLACE, in one card. Every direct child of
          `SCOPE_CARD_CLASS` gets a hairline above it — the blocker rows and
          the count strip are siblings, so the rules fall between them for
          free and no row has to draw its own. */}
      <div className={SCOPE_CARD_CLASS}>
        {blockers.length > 0 ? (
          blockers.map((b) => (
            <div
              key={b.label}
              // `lane`-shaped, not full-bleed: the label column is capped so a
              // sentence and its door are in the same glance. Stranding the
              // pill a thousand pixels right of its own label is what this row
              // used to do at 1700px.
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5"
            >
              {/* The dot is the only colour in this card, and it means
                  "unresolved". It is 7px because a blocker is a fact, not an
                  alarm — the console has no red banners. */}
              {/* Aligned to the FIRST LINE, not to the block. Centred, it drifts
                  to the middle of a three-line sentence on a phone and stops
                  reading as a marker for the label it belongs to. */}
              <span
                className="bg-primary mt-[7px] h-[7px] w-[7px] shrink-0 self-start rounded-full"
                aria-hidden
              />
              {/* A READABLE MEASURE, capped on the TEXT and never on the card
                  — the same move `FORM_COLUMN_CLASS` makes. Uncapped, the
                  sentence ran to 900px and shoved its own door off to a right
                  edge half a screen away. */}
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

        {/* THE COUNTS ARE A STRIP, NOT FOUR BOXES. One row of four at desktop,
            one column of four below `sm` — where each becomes label-left,
            value-right, because a stacked label over a single digit is three
            lines of chrome for one character. */}
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
                {c.value ?? "\u2014"}
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

      <Section
        title="Latest here"
        description="The last five things that happened. The whole log is on Activity."
        right={
          <Link href={placePageHref(place.id, "activity")} className={GHOST_PILL_BUTTON_CLASS}>
            Open Activity
          </Link>
        }
      >
        {events.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            hint="This fills the first time a guest does something here."
          />
        ) : (
          <ol className="flex flex-col">
            {events.map((e) => (
              <li
                key={e.id}
                className="border-border flex items-center gap-3 border-b py-2.5 last:border-0"
              >
                <Badge>{LOG_LABEL[e.log]}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{e.title}</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {e.detail}
                    {e.origin && <span> · from {e.origin.label}</span>}
                  </p>
                </div>
                {e.amountCents !== null && (
                  <p className="text-[13px] font-semibold tabular-nums">{money(e.amountCents)}</p>
                )}
                <p className={`${TINY_LABEL_CLASS} w-16 shrink-0 text-right`}>
                  {since(e.at, now)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}
