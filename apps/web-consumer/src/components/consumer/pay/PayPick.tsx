"use client";

import { Fragment, useState } from "react";
import { MapPin, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { offerSlides, voucherPct } from "@mesita/place-profile/lib/offers";
import { money, payPlaceCashbackBps, payPlaceDiscountBps, payPlaceTabs, type PayPlace } from "@/lib/api/wallet";
import { CONSUMER_ROUTES, payCodePath } from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import { useActiveLocation } from "@/lib/active-location";
import { useUserLocation } from "@/lib/use-user-location";
import { cn } from "@/lib/utils";
import { PlacePhoto, QUIET_BUTTON_CLASS } from "./pay-common";
import { BOX_TINT, TicketHeader } from "./pay-flow";
import { distanceText, type Loc, roundLocation, usePayLocation } from "./pay-location";
import { usePayPlaces } from "./use-pay-places";

// PAY BILL'S PLACE PICKER (Pato, 2026-11-17, MESITA-4232: "WHEN YOU CLICK
// THAT BUTTON, THEN A MODAL APPEARS"; MESITA-4478: it rises from the bottom
// over the wallet; a page again since MESITA-4837). It holds what was Pay's own box (MESITA-4204): a search
// bar always shown (MESITA-3725), then the places, every place the guest
// holds credit at pinned first, then the nearest up to PLACES_SHOWN and
// "Show all". A row opens the QR with that place over it
// (/pay/code?from=). The location is asked here only, after a priming card.
//
// NO BOX (Pato, 2026-11-17, MESITA-4280: "why inside a box … just use a
// searchbar and the places directly display separated by hr"): the search
// bar sits on its own under the header and the rows run edge to edge, a full
// hairline between them; the Panel with its side margins is gone.

// PREPAY & GET CREDITS USES IT TOO (Pato, 2026-11-21, MESITA-4597: "searchbar
// at the top and then just display first the 3 closest places. then display
// the list of all the loyalty cards you already have … don't display current
// balance. Just display name of the place and location and card. when you
// click the place, then you open its offers page"): `PlacePickBody` with
// `prepay` is /wallet/buy's whole body: no "Where are you paying?", only
// places that sell credits, the 3 closest (untitled since MESITA-4606) then
// "Your Loyalty Cards" (every place the guest holds credit at, not already above), each
// row the card-shaped photo, the name and the location line, no QR chip and
// no "Show all"; a search lists every match.

/** Places listed before "Show all" (MESITA-3720). */
const PLACES_SHOWN = 5;

/** /pay/pick (Pato, 2026-11-24, MESITA-4837: "make the user to select a
 *  place, not directly qr, even that the qr will be the same one ... he can
 *  see number of current credits as well as expected cashback"): the place
 *  first, then the same QR with that place over it. A place that is not
 *  listed still gets the QR. */
export function PayPickPage() {
  const router = useRouter();
  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col" data-pay-pick-page>
      <PlacePickBody
        onPick={(id) => navigateTo(router, payCodePath(id), { motion: "drill" })}
        onClose={() => goBack(router)}
      />
      <div className="border-border shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <PushLink
          href={CONSUMER_ROUTES.payCode}
          className={cn(QUIET_BUTTON_CLASS, "flex items-center justify-center")}
          data-pay-pick-any
        >
          My place isn&apos;t here
        </PushLink>
      </div>
    </div>
  );
}

/** The picker's shape while it loads. */
export function PayPickLoading() {
  const router = useRouter();
  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col">
      <TicketHeader title="Where are you paying?" onClose={() => goBack(router)} />
      <div className="px-4 pt-4 pb-2">
        <Skeleton className="h-12 w-full rounded-xl" aria-hidden />
      </div>
      <RowsSkeleton boxes={2} bare />
    </div>
  );
}

/** /wallet/buy's prepay count: the closest places listed first (MESITA-4597). */
const NEAR_SHOWN = 3;

export function PlacePickBody({
  onPick: onPickId,
  onClose,
  prepay = false,
}: {
  onPick: (placeId: string, place?: PayPlace) => void;
  /** Pay Bill's ✕ (MESITA-4598): closes the flow. */
  onClose?: () => void;
  /** /wallet/buy: the places that sell a voucher (MESITA-4731, D5). */
  prepay?: boolean;
}) {
  // THE LIST SORTS FROM THE HEADER'S BOX (MESITA-4748, D7): on /wallet/buy
  // a saved location wins, else the phone's fix; no priming card there (the
  // box asks). Pay Bill's sheet keeps its own card and the phone's fix.
  const { loc, askLocation, notNow } = usePayLocation({ prime: !prepay });
  const active = useActiveLocation();
  const fix = useUserLocation();
  const phone = loc.state === "on" ? loc.at : null;
  const at = prepay ? (active ? roundLocation(active) : fix ? roundLocation(fix) : phone) : phone;
  const { places: all, failed, refresh } = usePayPlaces(at);
  const boxes: BoxKind = prepay ? "vouchers" : "mine";
  // MESITA-4698: Get Discounts lists the places with offers (Loyalty
  // Cards On). MESITA-4708: no card_ok fallback (a bill has no card part).
  const places = prepay && all ? all.filter((p) => payPlaceTabs(p).prepay) : all;
  const onPick = (id: string) => onPickId(id, all?.find((p) => p.place_id === id));
  const [query, setQuery] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-pay-box>
      {/* STEP 1 OF THE FLOW (Pato, 2026-11-21, MESITA-4598: "where are you
          paying must look like this. in fact is the first step of the payment
          flow. put attention to the X on top right to close the modal"; the
          inKind picker he sent): the question at 20px on the left, a 44px ✕
          on the right, a hairline under; an outlined search box. */}
      {prepay ? null : <TicketHeader title="Where are you paying?" onClose={onClose} />}
      {/* A REAL FIELD (MESITA-4295, Pato: "better design"): the bare
          SearchBar in a 44px grey pill; outlined on Pay Bill since MESITA-4598.
          The list under it stays boxless (MESITA-4280). It is not focused on
          open (MESITA-2939). */}
      {/* ONE LOOK FOR BOTH (Pato, 2026-11-21, MESITA-4619: "keep same
          structure here"): Prepay & Get Credits wears the picker's outlined
          search box and rows. */}
      <div className="px-4 pt-4 pb-2">
        <div className="border-border bg-card flex h-12 items-center rounded-xl border pr-1 pl-4" data-pay-pick-search>
          <SearchBar
            query={query}
            showClear={query.length > 0}
            onQueryChange={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search a place"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {places ? (
          <PlaceList
            places={places}
            query={query}
            loc={loc}
            onPick={onPick}
            onUseLocation={askLocation}
            onNotNow={notNow}
            prepay={prepay}
            boxes={boxes}
          />
        ) : failed ? (
          <div className="px-5 py-4">
            <EmptyState
              inline
              icon={QrCode}
              title="Couldn't load the places"
              description="Check your connection and try again."
              action={{ label: "Try again", onClick: refresh }}
            />
          </div>
        ) : (
          <RowsSkeleton boxes={boxes === "mine" ? 2 : 3} />
        )}
      </div>
      {/* PICK IS STEP 0 (Pato, 2026-11-21, MESITA-4635: "don't even mention
          pick a step. that is fake"): the picker is the front and wears no
          strip; the ticket's strip starts at 1 Bill. */}
    </div>
  );
}

/** Lower case, no accents: "Cafe" finds "Café". */
function fold(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function PlaceList({
  places,
  query,
  loc,
  onPick,
  onUseLocation,
  onNotNow,
  prepay = false,
  boxes,
}: {
  prepay?: boolean;
  boxes: BoxKind;
  places: PayPlace[];
  query: string;
  loc: Loc;
  onPick: (placeId: string) => void;
  onUseLocation: () => void;
  onNotNow: () => void;
}) {
  const q = fold(query.trim());
  const [showAll, setShowAll] = useState(false);
  const matches = q ? places.filter((p) => fold(p.name ?? "").includes(q)) : places;
  // Every place the guest holds credit at, at any distance, then the nearest
  // up to PLACES_SHOWN; a search always lists every match.
  const held = matches.filter((p) => p.available_cents > 0);
  const near = matches.filter((p) => p.available_cents <= 0);
  const shown = q || showAll ? matches : [...held, ...near.slice(0, Math.max(0, PLACES_SHOWN - held.length))];
  const hidden = prepay ? 0 : matches.length - shown.length;
  const holds = (p: PayPlace) => p.available_cents > 0 || p.pending_cents > 0;
  const nearest = matches.slice(0, NEAR_SHOWN);
  const nearIds = new Set(nearest.map((p) => p.place_id));
  const cards = matches.filter((p) => holds(p) && !nearIds.has(p.place_id));
  return (
    <div className="flex flex-col">
      {prepay ? null : loc.state === "prime" ? (
        <div className="px-5 py-3">
          <p className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            See places near you
          </p>
          <div className="mt-3 flex gap-2">
            <Button className="min-h-11 flex-1 font-semibold" onClick={onUseLocation}>
              Use my location
            </Button>
            <button
              type="button"
              className="border-border bg-card hover:bg-muted min-h-11 flex-1 rounded-xl border px-4 text-sm font-semibold transition"
              onClick={onNotNow}
            >
              Not now
            </button>
          </div>
        </div>
      ) : loc.state === "blocked" ? (
        <p className="text-muted-foreground px-5 py-2 text-sm">
          Location is off for mesita.ai. Turn it on in your browser&apos;s site settings.
        </p>
      ) : null}

      {loc.state === "asking" && places.length === 0 ? (
        <RowsSkeleton boxes={boxes === "mine" ? 2 : 3} />
      ) : places.length === 0 ? (
        <div className="px-5 py-4">
          <EmptyState
            inline
            icon={MapPin}
            title={
              loc.state === "on"
                ? "No Mesita place near you"
                : "Turn on location to see places near you"
            }
            description=""
          />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">No place matches &ldquo;{query.trim()}&rdquo;</p>
      ) : (
        // SECTIONS (MESITA-4295): the places you hold credit at, then the
        // nearest; a search is one list. The rows run edge to edge
        // (MESITA-4280) with a hairline between them.
        <div data-pay-places>
          {q ? (
            <Section title="Results" places={prepay ? matches : shown} onPick={onPick} boxes={boxes} />
          ) : prepay ? (
            <>
              {/* NO "NEAR YOU" (Pato, 2026-11-21, MESITA-4606: "its ugly and
                  kinda obvious"): the closest places come first untitled. */}
              <Section places={nearest} onPick={onPick} boxes={boxes} />
              <Section title="Your Loyalty Cards" places={cards} onPick={onPick} boxes={boxes} />
            </>
          ) : (
            <>
              {/* ONE LIST, CARDS FIRST (MESITA-4598, Pato picked it): no group
                  titles; the places he holds credit at, then the nearest. */}
              <Section places={shown} onPick={onPick} boxes={boxes} />
            </>
          )}
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="border-border hover:bg-muted/60 flex min-h-12 w-full items-center justify-center border-t px-5 text-sm font-semibold transition"
            >
              Show all {matches.length} places
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** One eyebrow and its rows; none, nothing. */
function Section({
  title,
  places,
  onPick,
  boxes,
}: {
  title?: string;
  places: PayPlace[];
  onPick: (placeId: string) => void;
  boxes: BoxKind;
}) {
  if (places.length === 0) return null;
  return (
    <section className="mt-3">
      {title ? <p className="type-eyebrow text-muted-foreground px-5 pb-2">{title}</p> : null}
      <div className="border-border divide-border divide-y border-y">
        {places.map((p) => (
          <PlaceRow key={p.place_id} p={p} onPick={onPick} boxes={boxes} />
        ))}
      </div>
    </section>
  );
}

/** Which offers a row previews (MESITA-4748): Prepay's vouchers, every kind
 *  on Explore Offers, or what this guest has and gets there (MESITA-4837). */
type BoxKind = "vouchers" | "any" | "mine";
type OfferBox = { top: string; bottom: string; tone: string; key: string };

const VOUCHERS_SHOWN = ["voucher_200", "voucher_1000", "voucher_5000"] as const;
const pesos = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** THE OFFERS UNDER A PLACE (Pato, 2026-11-23, MESITA-4748: "list the place,
 *  and below display like the amounts … ($200MX +20%) ($1,000MX + 30%)
 *  ($5,000MX + 30%)"; for the bill "Welcome (50% Back) Returning (X% Back)";
 *  /plan-design-review D6): small tinted boxes, the amount or the name over
 *  the bonus. The vouchers' bonuses are the place's picks (MESITA-4764). Equal
 *  Welcome and Returning rates are one "Every bill" box. */
export function offerBoxes(p: PayPlace, kind: BoxKind): OfferBox[] {
  // WHAT TO EXPECT (MESITA-4837): the guest's credits here, then what their
  // own next bill gets, in their own tier; nothing to say, no box.
  if (kind === "mine") {
    const discount = payPlaceDiscountBps(p);
    const cashback = payPlaceCashbackBps(p);
    return [
      ...(p.available_cents > 0
        ? [{ key: "credits", top: "Your credits", bottom: money(p.available_cents, p.currency), tone: BOX_TINT.prepay }]
        : []),
      ...(discount > 0
        ? [{ key: "discount", top: "On this bill", bottom: `${discount / 100}% Discount`, tone: BOX_TINT.discount }]
        : cashback > 0
          ? [{ key: "cashback", top: "On this bill", bottom: `${cashback / 100}% Cashback`, tone: BOX_TINT.cashback }]
          : []),
    ];
  }
  const o = p.offers;
  if (!o) return [];
  if (kind === "vouchers") {
    return VOUCHERS_SHOWN.filter((k) => o.sell.includes(k)).map((k) => {
      const pay = Number(k.slice("voucher_".length));
      const pct = voucherPct(o, k);
      return {
        key: k,
        top: `$${pesos.format(pay)}`,
        bottom: `Get $${pesos.format(Math.round((pay * (100 + pct)) / 100))}`,
        tone: BOX_TINT.prepay,
      };
    });
  }
  // MESITA-4770: the visit lines read "Off" (Discount, green) or "Back"
  // (Cashback, red-pink).
  const discount = o.visit_mechanism === "discount";
  // MESITA-4777: the words themselves, "Discount" or "Cashback".
  const word = discount ? "Discount" : "Cashback";
  const visitTint = discount ? BOX_TINT.discount : BOX_TINT.cashback;
  // Explore Offers: one box per kind, Prepay · Pay, in offerSlides' words.
  const order: Record<string, number> = { prepay: 0, cashback: 1 };
  return offerSlides(o)
    .filter((sl) => sl.key in order)
    .sort((a, b) => order[a.key] - order[b.key])
    .map((sl) => ({
      key: sl.key,
      top: sl.lead,
      // "UP TO" ON PREPAY (Pato, 2026-11-23, MESITA-4795: "mention in prepay
      // Up to x% bonus"): the place's highest voucher bonus.
      bottom: sl.key === "prepay" ? prepayUpTo(o) ?? sl.pillShort : payUpTo(o, word) ?? sl.pillShort,
      tone: sl.key === "prepay" ? BOX_TINT.prepay : visitTint,
    }));
}

/** "Up to N% Bonus": the highest bonus among the vouchers this place sells
 *  (MESITA-4795); null when it sells none. */
function prepayUpTo(o: NonNullable<PayPlace["offers"]>): string | null {
  const pcts = VOUCHERS_SHOWN.filter((k) => o.sell.includes(k)).map((k) => voucherPct(o, k));
  return pcts.length > 0 ? `Up to ${Math.max(...pcts)}% Bonus` : null;
}

/** "Up to N% Discount" or "Cashback" (Pato, 2026-11-23, MESITA-4816: "in pay
 *  also mention up to x% discount"): the highest of the four visit lines;
 *  null when the place has none on. */
function payUpTo(o: NonNullable<PayPlace["offers"]>, word: string): string | null {
  const lines = [o.welcome_pct, o.returning_pct, o.welcome_vip_pct, o.returning_vip_pct];
  const top = Math.max(0, ...lines.map((n) => n ?? 0));
  return top > 0 ? `Up to ${top}% ${word}` : null;
}

/** A place: photo, name, the address on one line and the distance; under
 *  them its offer boxes (MESITA-4748). The row is the one button (D8): the
 *  boxes are a preview, read aloud in the row's label. */
function PlaceRow({ p, onPick, boxes }: { p: PayPlace; onPick: (placeId: string) => void; boxes: BoxKind }) {
  const distance = p.distance_m !== null ? distanceText(p.distance_m) : null;
  const name = p.name ?? "A Mesita place";
  const shown = offerBoxes(p, boxes);
  const spoken = [name, distance, ...shown.map((b) => `${b.top} ${b.bottom}`)].filter(Boolean).join(", ");
  return (
    <button
      type="button"
      onClick={() => onPick(p.place_id)}
      aria-label={spoken}
      className="hover:bg-muted/60 flex w-full flex-col px-3.5 py-2.5 text-left transition"
      data-pay-pick-place
    >
      <span className="flex w-full items-start gap-3.5">
        <PlacePhoto place={p} className="h-11 w-11" />
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block truncate text-sm font-semibold">{name}</span>
          {p.address ? (
            <span className={cn("text-muted-foreground mt-0.5 text-sm", shown.length > 0 ? "block truncate" : "line-clamp-2")}>{p.address}</span>
          ) : null}
        </span>
        {distance ? <span className="text-muted-foreground shrink-0 pt-0.5 text-sm tabular-nums">{distance}</span> : null}
      </span>
      {shown.length > 0 ? (
        // ONE ROW OF EQUAL COLUMNS (Pato, 2026-11-24, MESITA-4837: "cleaner,
        // in three columns same row"): Prepay's vouchers too; a row per
        // amount before (MESITA-4795).
        // MESITA-4778 (Pato: "prepay box 50% and pay box 50% wide too"):
        // two boxes are halves, three are thirds; 14px words, shorter boxes.
        <span className={cn("mt-2 grid w-full gap-2", shown.length < 3 ? "grid-cols-2" : "grid-cols-3")} aria-hidden data-offer-boxes>
          {shown.map((b) => (
            <span key={b.key} className={cn("text-foreground min-w-0 rounded-lg px-2.5 py-1.5", b.tone)}>
              <span className="block truncate text-sm leading-tight font-semibold tabular-nums">{b.top}</span>
              <span className="mt-0.5 block truncate text-xs leading-tight font-semibold tabular-nums">{b.bottom}</span>
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

/** The Offers tab a place opens on (MESITA-4731, D5): its first offer,
 *  Prepay, else Pay. */
export function firstOfferTab(p: PayPlace | undefined): "prepayment" | "cashback" | null {
  const t = p ? payPlaceTabs(p) : null;
  return !t || t.prepay ? "prepayment" : t.pay ? "cashback" : null;
}

/** Explore Offers' list: the places with any offer (MESITA-4731). */
export function hasOffers(p: PayPlace): boolean {
  const t = payPlaceTabs(p);
  return p.offers_ok === true && (t.prepay || t.pay);
}

/** PAY'S NEARBY OFFERS TAB (Pato, 2026-11-23, MESITA-4765: "nearby offers
 *  you are going to display that feed from explore offers but below in the
 *  paypage"; /plan-design-review D3, D5): Explore Offers' rows, every place
 *  with an offer, nearest first, each with its offer boxes; a row opens its
 *  Offers. No search bar, no location box, no Loyalty Cards section (the other
 *  tab). The location card sits on top until the guest answers it. */
export function NearbyOffers({
  places,
  failed,
  loc,
  onUseLocation,
  onNotNow,
  onRefresh,
  onPick,
}: {
  /** Nearest first; null while they load. */
  places: PayPlace[] | null;
  failed: boolean;
  loc: Loc;
  onUseLocation: () => void;
  onNotNow: () => void;
  onRefresh: () => void;
  onPick: (placeId: string) => void;
}) {
  const offers = (places ?? []).filter(hasOffers);
  return (
    <div className="flex flex-col" data-nearby-offers>
      {loc.state === "prime" ? (
        <div className="border-border border-b p-3" data-nearby-offers-location>
          <p className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            See offers near you
          </p>
          <div className="mt-3 flex gap-2">
            <Button className="min-h-11 flex-1 font-semibold" onClick={onUseLocation}>
              Use my location
            </Button>
            <button
              type="button"
              className="border-border bg-card hover:bg-muted min-h-11 flex-1 rounded-xl border px-4 text-sm font-semibold transition"
              onClick={onNotNow}
            >
              Not now
            </button>
          </div>
        </div>
      ) : loc.state === "blocked" ? (
        <p className="text-muted-foreground border-border border-b px-4 py-3 text-sm">
          Location is off for mesita.ai. Turn it on in your browser&apos;s site settings.
        </p>
      ) : null}
      {failed ? (
        <p className="text-muted-foreground px-4 py-4 text-sm" role="alert" data-error="pay_places_unavailable">
          Couldn&apos;t load the places.
          <button type="button" className="text-foreground ml-2 font-semibold underline" onClick={onRefresh}>
            Try again
          </button>
        </p>
      ) : places === null || loc.state === "asking" ? (
        <RowsSkeleton boxes={3} bare />
      ) : offers.length === 0 ? (
        <p className="text-muted-foreground px-4 py-4 text-sm" data-nearby-offers-empty>
          {loc.state === "on" ? "No offers near you yet" : "Turn on location to see offers near you"}
        </p>
      ) : (
        <div className="divide-border flex flex-col divide-y">
          {offers.map((p) => (
            <PlaceRow key={p.place_id} p={p} onPick={onPick} boxes="any" />
          ))}
        </div>
      )}
    </div>
  );
}

function RowsSkeleton({ boxes = 0, bare = false }: { boxes?: number; bare?: boolean }) {
  return (
    <div className={bare ? undefined : "mt-3"} aria-busy>
      {bare ? null : <Skeleton className="mx-5 mb-2 h-3 w-20" />}
      <div className={cn("divide-border divide-y", bare ? null : "border-border border-y")}>
      {[0, 1, 2].map((i) => (
        <Fragment key={i}>
          <div className="px-4 py-3">
            <div className="flex items-start gap-3.5">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="flex-1 pt-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
              <Skeleton className="mt-1 h-3 w-10" />
            </div>
            {/* The offer boxes' bones (MESITA-4748): the row's own shape. */}
            {boxes > 0 ? (
              <div className={cn("mt-2.5 grid gap-2", boxes === 2 ? "grid-cols-2" : "grid-cols-3")}>
                {Array.from({ length: boxes }, (_, b) => (
                  <Skeleton key={b} className="h-[42px] min-w-0 rounded-lg" />
                ))}
              </div>
            ) : null}
          </div>
        </Fragment>
      ))}
      </div>
    </div>
  );
}
