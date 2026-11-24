"use client";

import { useState } from "react";
import { MapPin, QrCode } from "lucide-react";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { voucherPct } from "@mesita/place-profile/lib/offers";
import { money, payPlaceCashbackBps, payPlaceDiscountBps, payPlaceTabs, type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { PlacePhoto } from "./pay-common";
import { BOX_TINT } from "./pay-flow";
import { distanceText, type Loc } from "./pay-location";

// THE WALLET'S TWO PLACE LISTS (MESITA-4838, Pato: "if i select prepay, then
// the box below displays all the prepay options ... if i select pay, then i
// see places to select below"): a search box and the places, in the menu's
// box. Prepay lists the places that sell credit, nearest first, with their
// vouchers; a row opens its Offers. Pay lists every place, the ones the guest
// holds credit at first, with their credits and what their next bill gets; a
// row opens the one QR with that place over it. The reads and the location
// are PayPage's, shared by both. They were a sheet (MESITA-4232), /wallet/buy
// (MESITA-4597), Nearby Offers (MESITA-4765) and /pay/pick (MESITA-4837).

type ListKind = "prepay" | "pay";

export function PlaceList({
  kind,
  places: all,
  failed,
  loc,
  onUseLocation,
  onNotNow,
  onRefresh,
  onPick,
}: {
  kind: ListKind;
  /** Nearest first; null while they load. */
  places: PayPlace[] | null;
  failed: boolean;
  loc: Loc;
  onUseLocation: () => void;
  onNotNow: () => void;
  onRefresh: () => void;
  onPick: (placeId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const places = all && kind === "prepay" ? all.filter((p) => payPlaceTabs(p).prepay) : all;
  const matches = (places ?? []).filter((p) => !q || fold(p.name ?? "").includes(q));
  const shown =
    kind === "pay" ? [...matches.filter((p) => p.available_cents > 0), ...matches.filter((p) => p.available_cents <= 0)] : matches;
  return (
    <div className="flex flex-col" data-pay-list={kind}>
      <div className="bg-card sticky top-0 z-10 p-2.5">
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
      {loc.state === "prime" ? (
        <div className="border-border border-t px-3.5 py-3">
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
        <p className="text-muted-foreground border-border border-t px-3.5 py-3 text-sm">
          Location is off for mesita.ai. Turn it on in your browser&apos;s site settings.
        </p>
      ) : null}
      {places === null && failed ? (
        <div className="px-3.5 py-4">
          <EmptyState
            inline
            icon={QrCode}
            title="Couldn't load the places"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: onRefresh }}
          />
        </div>
      ) : places === null || (loc.state === "asking" && places.length === 0) ? (
        <RowsSkeleton />
      ) : places.length === 0 ? (
        <p className="text-muted-foreground border-border border-t px-3.5 py-4 text-sm">
          {loc.state !== "on"
            ? "Turn on location to see places near you"
            : kind === "prepay"
              ? "No place near you sells credit yet"
              : "No Mesita place near you"}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground border-border border-t px-3.5 py-4 text-sm">No place matches &ldquo;{query.trim()}&rdquo;</p>
      ) : (
        <div className="border-border divide-border divide-y border-y" data-pay-places>
          {shown.map((p) => (
            <PlaceRow key={p.place_id} p={p} onPick={onPick} kind={kind} />
          ))}
        </div>
      )}
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

type OfferBox = { top: string; bottom: string; bonus?: string; tone: string; key: string };

const VOUCHERS_SHOWN = ["voucher_200", "voucher_1000", "voucher_5000"] as const;
const pesos = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** THE BOXES UNDER A PLACE. Prepay: each voucher it sells, what you pay over
 *  its bonus. Pay (MESITA-4837): the guest's credits here, then what their
 *  own next bill gets and as which visit. */
function offerBoxes(p: PayPlace, kind: ListKind): OfferBox[] {
  if (kind === "prepay") {
    const o = p.offers;
    if (!o) return [];
    return VOUCHERS_SHOWN.filter((k) => o.sell.includes(k)).map((k) => {
      const pay = Number(k.slice("voucher_".length));
      const pct = voucherPct(o, k);
      return {
        key: k,
        // THE BONUS, NOT THE TOTAL (Pato, 2026-11-24, MESITA-4840: "for $200,
        // get +10% bonus ... the bonuses is clearer"): Offers says what you get.
        top: `$${pesos.format(pay)}`,
        bottom: pct > 0 ? `+${pct}%` : "No bonus",
        tone: BOX_TINT.prepay,
      };
    });
  }
  const discount = payPlaceDiscountBps(p);
  const cashback = payPlaceCashbackBps(p);
  const bps = discount || cashback;
  // GREY CREDITS, MORE SAID (Pato, 2026-11-24, MESITA-4839: "display maybe
  // more info here ... current credit in gray, not green"): always two boxes.
  return [
    {
      key: "credits",
      top: "Your credits",
      bottom: p.available_cents > 0 ? money(p.available_cents, p.currency) : "None yet",
      bonus: p.pending_cents > 0 ? `+${money(p.pending_cents, p.currency)} pending` : p.available_cents > 0 ? "Used first" : "Prepay to get some",
      tone: "bg-muted",
    },
    {
      key: "offer",
      top: "On this bill",
      bottom: bps > 0 ? `${bps / 100}% ${discount > 0 ? "Discount" : "Cashback"}` : "No offer",
      bonus: bps > 0 ? VISIT_NAME[p.visit_line ?? "welcome"] : "Pay as usual",
      tone: discount > 0 ? BOX_TINT.discount : cashback > 0 ? BOX_TINT.cashback : "bg-muted",
    },
  ];
}

/** The guest's own tier here, as Offers names it. */
const VISIT_NAME = {
  welcome: "Welcome Visit",
  returning: "Returning Visit",
  welcome_vip: "VIP Welcome Visit",
  returning_vip: "VIP Returning Visit",
} as const;

/** A place: photo, name, the address on one line and the distance; under
 *  them its offer boxes (MESITA-4748). The row is the one button (D8): the
 *  boxes are a preview, read aloud in the row's label. */
function PlaceRow({ p, onPick, kind }: { p: PayPlace; onPick: (placeId: string) => void; kind: ListKind }) {
  // PREPAY IS THE PHOTO AND THE NAME (Pato, 2026-11-24, MESITA-4841: "remove
  // the address, only pp, name and the bonuses"): no distance either.
  const distance = kind === "pay" && p.distance_m !== null ? distanceText(p.distance_m) : null;
  const name = p.name ?? "A Mesita place";
  const shown = offerBoxes(p, kind);
  const spoken = [name, distance, ...shown.map((b) => [b.top, kind === "prepay" && b.bottom.startsWith("+") ? `${b.bottom} Bonus` : b.bottom, b.bonus].filter(Boolean).join(" "))].filter(Boolean).join(", ");
  return (
    <button
      type="button"
      onClick={() => onPick(p.place_id)}
      aria-label={spoken}
      className="group flex w-full flex-col p-2.5 text-left"
      data-pay-pick-place
    >
      {/* THE GRID (Pato, 2026-11-24, MESITA-4839: "data in gray box, offers in
          green boxes"): the place's box, then its offers, on the search box's
          own edges, 6px apart. */}
      <span className="bg-muted group-hover:bg-foreground/10 flex w-full items-center gap-3 rounded-lg p-2.5 transition-colors">
        <PlacePhoto place={p} className="h-11 w-11" />
        <span className="min-w-0 flex-1">
          <span className={cn("font-semibold", kind === "prepay" ? "line-clamp-2 text-base leading-tight" : "block truncate text-sm")}>{name}</span>
          {p.address && kind === "pay" ? (
            <span className={"text-muted-foreground mt-0.5 block truncate text-sm"}>{p.address}</span>
          ) : null}
        </span>
        {distance ? <span className="text-muted-foreground shrink-0 self-start pt-0.5 text-sm tabular-nums">{distance}</span> : null}
      </span>
      {shown.length > 0 ? (
        // ONE ROW OF EQUAL COLUMNS (Pato, 2026-11-24, MESITA-4837: "cleaner,
        // in three columns same row"): Prepay's vouchers too; a row per
        // amount before (MESITA-4795).
        // MESITA-4778 (Pato: "prepay box 50% and pay box 50% wide too"):
        // two boxes are halves, three are thirds; 14px words, shorter boxes.
        <span className={cn("mt-1.5 grid w-full gap-1.5", shown.length < 3 ? "grid-cols-2" : "grid-cols-3")} aria-hidden data-offer-boxes>
          {shown.map((b) => (
            <span key={b.key} className={cn("text-foreground min-w-0 rounded-lg px-2 py-1.5", b.tone)}>
              <span className="block truncate text-sm leading-tight font-semibold tabular-nums">{kind === "prepay" ? <span className="max-[359px]:hidden">For </span> : null}
                {b.top}
              </span>
              <span className={cn("mt-0.5 block truncate leading-tight font-semibold tabular-nums", kind === "prepay" ? "text-sm text-indigo-700" : "text-xs")}>
                {b.bottom}
                {kind === "prepay" && b.bottom.startsWith("+") ? <span className="max-[359px]:hidden"> Bonus</span> : null}
              </span>
              {b.bonus ? <span className="text-foreground/70 mt-0.5 block truncate text-xs leading-tight font-semibold tabular-nums">{b.bonus}</span> : null}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

function RowsSkeleton() {
  return (
    <div className="border-border divide-border divide-y border-y" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="px-3.5 py-2.5">
          <div className="flex items-start gap-3.5">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1 pt-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
            <Skeleton className="mt-1 h-3 w-10" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Skeleton className="h-[42px] min-w-0 rounded-lg" />
            <Skeleton className="h-[42px] min-w-0 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
