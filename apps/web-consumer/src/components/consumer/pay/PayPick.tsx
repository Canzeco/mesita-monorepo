"use client";

import { useState } from "react";
import { ChevronRight, MapPin, QrCode } from "lucide-react";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { voucherPct } from "@mesita/place-profile/lib/offers";
import { payPlaceCashbackBps, payPlaceDiscountBps, payPlaceTabs, type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { PlacePhoto } from "./pay-common";
import type { Loc } from "./pay-location";

// THE WALLET'S TWO PLACE LISTS (MESITA-4838, Pato: "if i select prepay, then
// the box below displays all the prepay options ... if i select pay, then i
// see places to select below"): a search box and the places, in the menu's
// box. Prepay lists the places that sell credit, nearest first, with their
// vouchers; a row opens its Offers. Pay lists every place, the ones the guest
// holds credit at first, with what their next bill gets; a
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
      {/* The whole row is the field (MESITA-4842), a hairline under it. */}
      <div className="bg-card border-border sticky top-0 z-20 flex h-14 items-center border-b pr-1 pl-4" data-pay-pick-search>
        <SearchBar
          query={query}
          showClear={query.length > 0}
          onQueryChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Search a place"
        />
      </div>
      {loc.state === "prime" ? (
        <div className="border-border border-b px-3.5 py-3">
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
        <p className="text-muted-foreground border-border border-b px-3.5 py-3 text-sm">
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
        <RowsSkeleton kind={kind} />
      ) : places.length === 0 ? (
        <p className="text-muted-foreground px-3.5 py-4 text-sm">
          {loc.state !== "on"
            ? "Turn on location to see places near you"
            : kind === "prepay"
              ? "No place near you sells credit yet"
              : "No Mesita place near you"}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground px-3.5 py-4 text-sm">No place matches &ldquo;{query.trim()}&rdquo;</p>
      ) : (
        // A PLACE TABLE (Pato, 2026-11-24, MESITA-4844: "this looks like three
        // different buttons ... it must look like place selector"): one row
        // per place, one tap; plain columns, no boxes.
        <div data-pay-places>
          {kind === "prepay" ? (
            <div className={cn(PREPAY_GRID, "border-border bg-muted text-muted-foreground sticky top-14 z-10 h-11 border-b text-xs font-semibold")} aria-hidden data-pay-head-row>
              <span className="pl-3.5">Place</span>
              {PREPAY_HEADS.map((h) => (
                <span key={h} className="text-foreground text-center text-base tabular-nums max-[374px]:text-sm">
                  {h}
                </span>
              ))}
              <span />
            </div>
          ) : null}
          <div className="divide-border border-border divide-y border-b">
            {shown.map((p, i) => (
              <PlaceRow key={`${p.place_id}:${i}`} p={p} onPick={onPick} kind={kind} />
            ))}
          </div>
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

const VOUCHERS_SHOWN = ["voucher_200", "voucher_1000", "voucher_5000"] as const;

/** Prepay's columns (Pato, 2026-11-24, MESITA-4845), a › ending every row
 *  (MESITA-4848). */
const PREPAY_HEADS = ["$200", "$1,000", "$5,000"];
const PREPAY_GRID = "grid w-full grid-cols-[46%_repeat(3,minmax(0,1fr))_1.5rem] items-center";

/** THE HIGHER THE BONUS, THE DARKER ITS PURPLE (Pato, 2026-11-24, MESITA-4860:
 *  "that way we can quickly spot the high bonuses"): Prepay's purple in four
 *  steps, by the percent itself, so a shade means the same in every row. */
function bonusShade(pct: number): string {
  if (pct >= 60) return "bg-[#352CB8] text-white";
  if (pct >= 40) return "bg-[#635BFF] text-white";
  if (pct >= 20) return "bg-[#BDB9FF] text-indigo-950";
  return "bg-[#E6E4FF] text-indigo-950";
}

/** A place, one row, the one button. */
function PlaceRow({ p, onPick, kind }: { p: PayPlace; onPick: (placeId: string) => void; kind: ListKind }) {
  return kind === "prepay" ? <PrepayRow p={p} onPick={onPick} /> : <PayRow p={p} onPick={onPick} />;
}

/** The bonus of each voucher it sells (– where it sells none). */
function PrepayRow({ p, onPick }: { p: PayPlace; onPick: (placeId: string) => void }) {
  const name = p.name ?? "A Mesita place";
  const bonuses = VOUCHERS_SHOWN.map((k) => (p.offers?.sell.includes(k) ? voucherPct(p.offers, k) : null));
  const spoken = [name, p.address, ...bonuses.map((pct, i) => (pct === null ? null : `${PREPAY_HEADS[i]}, +${pct}% bonus`))];
  return (
    <button
      type="button"
      onClick={() => onPick(p.place_id)}
      aria-label={spoken.filter(Boolean).join(", ")}
      className={cn(PREPAY_GRID, "hover:bg-muted/60 min-h-14 py-2 text-left transition-colors")}
      data-pay-pick-place
    >
      <span className="flex min-w-0 items-center gap-2.5 pr-1 pl-3.5">
        <PlacePhoto place={p} className="h-9 w-9 max-[359px]:hidden" />
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm leading-tight font-semibold">{name}</span>
          {/* Which branch it is (MESITA-4848). */}
          {p.address ? <span className="text-muted-foreground mt-0.5 block truncate text-xs leading-tight">{p.address}</span> : null}
        </span>
      </span>
      {bonuses.map((pct, i) => (
        <span key={VOUCHERS_SHOWN[i]} className="flex justify-center">
          {pct ? (
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold tabular-nums max-[359px]:h-10 max-[359px]:w-10", bonusShade(pct))}>
              +{pct}%
            </span>
          ) : (
            <span className="text-muted-foreground text-sm font-semibold">–</span>
          )}
        </span>
      ))}
      <ChevronRight className="text-muted-foreground h-4 w-4" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

/** PAY IS ROWS, NOT A TABLE (Pato, 2026-11-24, MESITA-4860, look A): the photo,
 *  the name over its address, a grey box with what this guest's next bill gets
 *  and a black Pay box. No credits: the Wallet's box has them. */
function PayRow({ p, onPick }: { p: PayPlace; onPick: (placeId: string) => void }) {
  const name = p.name ?? "A Mesita place";
  const discount = payPlaceDiscountBps(p);
  const bps = discount || payPlaceCashbackBps(p);
  const word = discount > 0 ? "Discount" : "Cashback";
  return (
    <button
      type="button"
      onClick={() => onPick(p.place_id)}
      aria-label={[`Pay at ${name}`, p.address, bps > 0 ? `${bps / 100}% ${word}` : null].filter(Boolean).join(", ")}
      className="hover:bg-muted/60 flex min-h-[72px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors max-[374px]:gap-2 max-[374px]:px-2.5"
      data-pay-pick-place
    >
      <PlacePhoto place={p} className="h-12 w-12 max-[359px]:hidden" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-base leading-tight font-semibold max-[429px]:text-sm">{name}</span>
        {p.address ? <span className="text-muted-foreground mt-0.5 block truncate text-sm leading-tight max-[429px]:text-xs">{p.address}</span> : null}
      </span>
      <span className="flex shrink-0 gap-1.5" aria-hidden>
        {bps > 0 ? (
          <span className="bg-muted flex h-12 w-[72px] flex-col items-center justify-center rounded-xl leading-tight max-[374px]:w-16">
            <span className="text-base leading-tight font-semibold tabular-nums">{bps / 100}%</span>
            <span className="text-muted-foreground text-xs leading-tight">{word}</span>
          </span>
        ) : null}
        <span className="bg-foreground text-background flex h-12 w-[58px] items-center justify-center rounded-xl text-base font-semibold max-[374px]:w-12 max-[374px]:text-sm">
          Pay
        </span>
      </span>
    </button>
  );
}

function RowsSkeleton({ kind }: { kind: ListKind }) {
  return (
    <div className="border-border divide-border divide-y border-b" aria-busy>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={cn("flex items-center px-3.5", kind === "pay" ? "h-[72px] gap-3" : "h-14 gap-2.5")}>
          <Skeleton className={cn("shrink-0 rounded-full", kind === "pay" ? "h-12 w-12" : "h-9 w-9")} />
          <Skeleton className="h-4 w-32" />
          <Skeleton className={cn("ml-auto", kind === "pay" ? "h-12 w-32 rounded-xl" : "h-4 w-28")} />
        </div>
      ))}
    </div>
  );
}
