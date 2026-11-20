"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, apiListVisits, type GuestTab, TAB_REFUSAL } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { addFundsOn, billRead, payHere, type BillRead } from "@/lib/pay-wallet";
import { clearGuestDraft, pendingTicket, readDraft } from "@/lib/guest-pay-draft";
import { readAmount } from "@mesita/place-profile/lib/money";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES, payBillPath, payPlacePath } from "@/lib/consumer-route-contract";
import { markPanelExit, navigateTo, previousEntryPath, replaceAddress } from "@/lib/navigate";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { forgetGuestTab, NETWORK_FAILURE, PlacePhoto, readGuestTabIds, CancelBillButtons } from "./pay-common";
import { distanceText } from "./pay-location";
import { PlaceActionRow } from "./PlaceActionRow";
import { MethodPreview } from "./MethodPreview";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { prepayHref } from "@/components/consumer/wallet/WalletPickers";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { usePayLocation } from "./pay-location";
import { usePayPlaces } from "./use-pay-places";
import { usePendingTicket } from "./PendingTicketBanner";
import { PayHeader } from "./PayHeader";
import { PayPickSheet } from "./PayPick";
import { TicketsShortcut } from "./TicketsShortcut";
import { WalletSection } from "@/components/consumer/wallet/WalletSection";

// THE PAY TAB, /pay (MESITA-3304 credit, MESITA-3305 the card part,
// MESITA-3457 the list, MESITA-3536 its look): the places the guest can pay
// at now, nearest first: a search bar always shown (Pato,
// MESITA-3725: "searchbar must always be visible"; MESITA-3719 had hidden it
// behind a magnifier up to six places), and rows of
// profile photo, name, address and distance, led by the guest's open bill.
// A row is a door: /pay/place/<placeId> opens that place's bill at the table
// (PayTabScreen, MESITA-3564). The bill and the receipt have their own
// addresses (MESITA-3614): /pay/bill/<id> and /pay/receipt/<id>.
//
// THE PAY TAB, REDRAWN (Pato, 2026-11-17, MESITA-4232; /plan-design-review
// D3-D13):
//
//   Wallet ................................... [Tickets] (grey)  (MESITA-4245)
//   [ ▦ Pay Bill ]  112px (MESITA-4272), Stripe purple, the one coloured thing (MESITA-4260)
//   [ Buy Credits ] [ Send Gift ] [ Share Mesita ]  grey, no box
//   Payment Method: [ Visa ••4242 · In the app ]  (MESITA-4477; the other box is Loyalty Cards)
//   Loyalty Cards: rows, black pill = ready, amber line = pending
//
// Pay Bill opens a sheet over this page (MESITA-4478): the search bar and
// the places that were this page's own box (MESITA-4204), rising from the
// bottom. At a place (within AT_PLACE_M) it reads "Pay Bill at <place>" and
// opens that bill, "Other place" under it opens the sheet. With a bill open
// it IS the bill (the amber panel below). The bar is Home · Search · Pay ·
// Me; /wallet forwards here. /pay/pick redirects here with ?pick=1.
//
// ONE OPEN PAYMENT (Pato, 2026-11-11, MESITA-3772: "you can only have one
// ticket opened at a time ... in the pay page just display the button to go
// the ticket"): while the guest has a payment of their own open (found on
// the server, so from any device, and on this device's list), the Pay half
// shows that bill; no search bar, no places. Since MESITA-4086 (Pato: "if I
// am in the pay page, then actually show the payment ticket not in the
// header but in the center") it is one panel at the top of the page
// (OpenBillPanel): the place, the amounts, its state and Continue; the amber
// band (PendingTicketBanner) shows on every other tab, never on /pay.
//
// The location is asked inside the place sheet only (pay-location.ts); Pay
// uses a fix the browser already grants.

export function PayPage({
  giftToken = null,
  pick = false,
}: {
  /** /wallet/gift/<token>: a friend's credit link opens over Pay. */
  giftToken?: string | null;
  /** /pay?pick=1: Choose another place, or /pay/pick, opens the sheet. */
  pick?: boolean;
} = {}) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickDismissed = useRef(false);
  // Pay never asks for the location (the picker does); a fix the browser
  // already grants names the place the guest is at (MESITA-4232, D5).
  const { loc, askLocation, notNow } = usePayLocation({ prime: true });
  const { places, failed: placesFailed, loading: placesLoading, refresh: refreshPlaces } = usePayPlaces(loc.state === "on" ? loc.at : null);
  const [query, setQuery] = useState("");
  // null while the open payment is still being looked for.
  const [openTabs, setOpenTabs] = useState<GuestTab[] | null>(null);
  const [billFacts, setBillFacts] = useState<{ visitsOk: boolean; missed: boolean } | null>(null);
  const [billNonce, setBillNonce] = useState(0);

  // The guest's own payments still in progress (paying, or paid and not yet
  // signed, inside their window), read fresh each time: the one the server
  // names (MESITA-3772, any device) and this device's list (MESITA-3709). A
  // finished one is forgotten. A failed server read falls back to the list.
  useEffect(() => {
    let cancelled = false;
    const local = readGuestTabIds();
    void apiListVisits(getSupabase())
      .then((r) => ({ ok: true as const, id: pickOpenGuestPayment(r.visits, Date.now())?.tab_id ?? null }))
      .catch(() => ({ ok: false as const, id: null as string | null }))
      .then((server) => {
        const ids = server.id
          ? [server.id, ...local.filter((x) => x !== server.id)]
          : local;
        return Promise.all(
          ids.map((id) =>
            apiGetTab(getSupabase(), id)
              .then((r) => r.tab)
              .catch((e) => {
                if (e instanceof EFError && (e.status === 404 || e.status === 403)) {
                  forgetGuestTab(id);
                  return null;
                }
                return "miss" as const;
              }),
          ),
        ).then((tabs) => ({ ok: server.ok, tabs }));
      })
      .then(({ ok, tabs }) => {
        if (cancelled) return;
        const now = Date.now();
        const missed = tabs.some((t) => t === "miss");
        const live = tabs.filter((t): t is GuestTab => {
          if (!t || t === "miss") return false;
          const open =
            !t.verified_at &&
            Date.parse(t.expires_at) > now &&
            (t.status === "paying" || t.status === "paid");
          if (!open) forgetGuestTab(t.tab_id);
          return open;
        });
        setOpenTabs(live);
        setBillFacts({ visitsOk: ok, missed });
      });
    return () => {
      cancelled = true;
    };
    // getSupabase is a new function each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billNonce]);

  const pending = usePendingTicket();
  const bill: BillRead =
    billFacts === null
      ? "loading"
      : billRead({
          visitsOk: billFacts.visitsOk,
          missed: billFacts.missed,
          live: openTabs?.length ?? 0,
          draft: pending !== null || pendingTicket() !== null,
        });

  useEffect(() => {
    if (billFacts) return;
    const id = window.setTimeout(() => setBillFacts({ visitsOk: false, missed: false }), 10_000);
    return () => window.clearTimeout(id);
  }, [billFacts]);

  // ?pick=1 waits for the bill read. A live tab or a draft strips the flag
  // and shows the bill. Otherwise the sheet opens on the entry that is
  // already there. A tap while the read is in flight hits the skeleton.
  useEffect(() => {
    if (!pick || bill === "loading") return;
    if (bill === "open" || bill === "unknown") {
      replaceAddress(CONSUMER_ROUTES.pay);
      return;
    }
    if (pickDismissed.current) return;
    setPickerOpen(true);
  }, [pick, bill]);

  // Browser Back while the sheet is open. Capture phase, so ScreenStage's
  // bubble listener sees the panel-exit mark and does not slide the wallet.
  // The browser already popped; this does not call history.back() again.
  useEffect(() => {
    if (!pickerOpen) return;
    function onPop() {
      setPickerOpen(false);
      markPanelExit();
    }
    window.addEventListener("popstate", onPop, true);
    return () => window.removeEventListener("popstate", onPop, true);
  }, [pickerOpen]);

  function closePicker() {
    setPickerOpen(false);
    const state = window.history.state as { paySheet?: number } | null;
    // history.back() fires popstate, and the capture listener marks the
    // panel exit. Marking here too would swallow the next slide.
    if (state?.paySheet === 1) {
      window.history.back();
      return;
    }
    if (!pick) return;
    pickDismissed.current = true;
    if (previousEntryPath() === CONSUMER_ROUTES.pay) {
      window.history.back();
      return;
    }
    markPanelExit();
    replaceAddress(CONSUMER_ROUTES.pay);
  }

  function choosePlace(id: string) {
    const href = payPlacePath(id);
    const state = window.history.state as { paySheet?: number } | null;
    const onPay = previousEntryPath() === CONSUMER_ROUTES.pay;
    setPickerOpen(false);
    if (state?.paySheet === 1 || (pick && onPay)) {
      navigateTo(router, href, { replace: true, motion: "push" });
      return;
    }
    if (pick) {
      pickDismissed.current = true;
      replaceAddress(CONSUMER_ROUTES.pay);
    }
    navigateTo(router, href, { motion: "push" });
  }

  return (
    // 8PX, NOT 16 (Pato, 2026-11-17, MESITA-4276: "make body margins far
    // smaller in this page ... it feels like an old mobile app from the
    // 2010s"): 8px at the sides and 8px between Pay Bill, the doors and each
    // panel, Home's one step (MESITA-4035); panels keep their 16px insides.
    <KeptScroll className="scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-2 pb-8 *:shrink-0">
      {/* The header: the title and Tickets, a quiet grey pill (MESITA-4232).
          "Wallet" since MESITA-4245 (Pato: "the header just saying pay is
          shit"; /autoplan): the page holds your money, the pink Pay Bill is
          the verb. "Mesita Wallet" since MESITA-4252 (Pato: "call at the top
          Mesita Wallet, not only wallet"); the bar tab stays "Wallet". */}
      <PayHeader
        title="Wallet"
        action={
          <span className="flex min-w-0 items-center gap-2">
            <MethodPreview />
            <TicketsShortcut className="h-11" />
          </span>
        }
        bar={
          <SearchBar
            query={query}
            showClear={query.length > 0}
            onQueryChange={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search places and cards"
          />
        }
      />

      {bill === "open" ? (
        <div className="mt-2 flex flex-col">
          <OpenBillPanel
            tab={openTabs?.[0] ?? null}
            pending={pending}
            places={places}
            onCancelled={(tabId) => {
              setOpenTabs((t) => (t ? t.filter((x) => x.tab_id !== tabId) : t));
              setBillFacts({ visitsOk: true, missed: false });
            }}
          />
        </div>
      ) : null}
      {bill === "unknown" ? (
        <p className="text-muted-foreground px-2 py-3 text-sm" role="alert" data-error="open_bill_unknown">
          Couldn&apos;t check for an open bill. Pay Here stays off. Tap Check again.
          <button
            type="button"
            className="text-foreground ml-2 font-semibold underline"
            onClick={() => {
              setBillFacts(null);
              setBillNonce((n) => n + 1);
            }}
          >
            Check again
          </button>
        </p>
      ) : null}

      <PlaceList
        places={places}
        failed={placesFailed}
        loading={placesLoading}
        query={query}
        loc={loc.state}
        bill={bill}
        openPlaceId={openTabs?.[0]?.place.id ?? pending?.placeId ?? null}
        openHref={openTabs?.[0] ? payBillPath(openTabs[0].tab_id) : pending ? payPlacePath(pending.placeId) : null}
        onRefresh={refreshPlaces}
        onAskLocation={askLocation}
        onNotNow={notNow}
      />

      <WalletSection giftToken={giftToken} />
      <PayPickSheet open={pickerOpen} onClose={closePicker} onPick={choosePlace} />
    </KeptScroll>
  );
}

function fold(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function PlaceList({
  places,
  failed,
  loading,
  query,
  loc,
  bill,
  openPlaceId,
  openHref,
  onRefresh,
  onAskLocation,
  onNotNow,
}: {
  places: PayPlace[] | null;
  failed: boolean;
  loading: boolean;
  query: string;
  loc: string;
  bill: BillRead;
  openPlaceId: string | null;
  openHref: string | null;
  onRefresh: () => void;
  onAskLocation: () => void;
  onNotNow: () => void;
}) {
  const router = useRouter();
  const q = fold(query.trim());
  const sorted = [...(places ?? [])].sort((a, b) => {
    if (a.distance_m === null) return 1;
    if (b.distance_m === null) return -1;
    return a.distance_m - b.distance_m;
  });
  const shown = q ? sorted.filter((p) => fold(p.name ?? "").includes(q)) : sorted;
  return (
    <section className="mt-3 flex flex-col gap-2" aria-label="Places">
      <h2 className="text-muted-foreground px-2 text-sm font-semibold">Places</h2>
      {loc === "prime" ? (
        <div className="border-border rounded-xl border p-3">
          <p className="text-sm font-semibold">See places near you</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="bg-foreground text-background h-11 flex-1 rounded-xl text-sm" onClick={onAskLocation}>
              Use my location
            </button>
            <button type="button" className="border-border h-11 flex-1 rounded-xl border text-sm" onClick={onNotNow}>
              Not now
            </button>
          </div>
        </div>
      ) : null}
      {failed ? (
        <p className="text-muted-foreground px-2 text-sm" role="alert" data-error="pay_places_unavailable">
          Couldn&apos;t load the places. Tap Try again.
          <button type="button" className="text-foreground ml-2 font-semibold underline" onClick={onRefresh}>
            Try again
          </button>
        </p>
      ) : loading && places === null ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground px-2 text-sm">
          {q ? `No place matches “${query.trim()}”.` : loc === "on" ? "No place near you takes App Payments" : "No places to pay at yet."}
        </p>
      ) : (
        shown.map((p) => {
          const name = p.name ?? "A Mesita place";
          const subtitle = [p.distance_m !== null ? distanceText(p.distance_m) : null, p.address].filter(Boolean).join(" · ");
          const here = payHere(bill, p.place_id === openPlaceId);
          const funds = addFundsOn(p.card_ok);
          return (
            <PlaceActionRow
              key={p.place_id}
              name={name}
              subtitle={subtitle || null}
              photo={<PlacePhoto place={p} className="h-10 w-10" />}
              extra={
                <>
                  {p.available_cents > 0 ? (
                    <span className="bg-foreground text-background mt-1 inline-block rounded-full px-2 py-0.5 text-xs">{money(p.available_cents, p.currency)}</span>
                  ) : null}
                  {p.pending_cents > 0 ? <span className="text-muted-foreground block text-sm">{money(p.pending_cents, p.currency)} pending</span> : null}
                </>
              }
              left={{
                label: "Add Funds",
                disabled: !funds,
                description: funds ? undefined : "This place doesn't sell credit.",
                onClick: () => navigateTo(router, prepayHref(p.place_id), { motion: "drill" }),
              }}
              right={{
                label: "Pay Here",
                filled: true,
                disabled: here === "blocked",
                description: here === "blocked" && bill === "open" ? "Finish or cancel the open bill first." : undefined,
                onClick: () => {
                  const href = here === "bill" ? openHref : payPlacePath(p.place_id);
                  if (href) navigateTo(router, href, { motion: "push" });
                },
              }}
            />
          );
        })
      )}
    </section>
  );
}

/** Pay Bill's shape while the open-bill read runs, so a bill that is open
 *  never flashes the black button first. */
export function PayBillSkeleton() {
  return <Skeleton className="mt-2 h-28 w-full rounded-2xl" aria-hidden />;
}

/** The open bill on /pay (MESITA-4086): one panel, the place's photo and
 *  name, the bill (with tip and total once known), its state, then one
 *  black Continue to the same address the amber band opens. A bill sent to
 *  the waiter wins over one still being filled in on this phone, as in the
 *  band. Read from what Pay already holds: no new call.
 *
 *  AMBER, AND IT WARNS (Pato, 2026-11-15, MESITA-4091: "if i leaved something
 *  open, write it yellow and mention that must be completed or canceled
 *  before creating other ticket"): the band's amber, the line "Finish or
 *  cancel this bill before you start a new one.", and a quiet Cancel bill
 *  under Continue. It asks first, like every Cancel bill (MESITA-4068); a
 *  draft is thrown away on this phone, a sent bill goes through the guest's
 *  own cancel (consumer-web-cancel-tab, as on the bill's page). */
function OpenBillPanel({
  tab,
  pending,
  places,
  onCancelled,
}: {
  tab: GuestTab | null;
  pending: { placeId: string; name: string | null } | null;
  places: PayPlace[] | null;
  /** The bill is gone: Pay shows its places again. `null` for a draft. */
  onCancelled: (tabId: string | null) => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeId = tab ? tab.place.id : (pending?.placeId ?? "");
  const listed = places?.find((p) => p.place_id === placeId);
  const name = (tab ? tab.place.name : pending?.name) ?? listed?.name ?? null;
  const href = tab ? payBillPath(tab.tab_id) : payPlacePath(placeId);
  const what = tab ? "Waiting for the waiter's signature" : "Bill in progress";
  const draft = tab ? null : readDraft(placeId);
  const currency = tab?.currency ?? listed?.currency ?? "mxn";
  const bill = tab ? tab.bill_cents : draft ? readAmount(draft.amount) : null;
  const tip = tab ? tab.card_tip_cents + tab.cash_tip_cents : null;
  // THE SIGN TIMER (MESITA-4130, Pato: "if sign, add the timer to sign in
  // the outside ticket"): the same countdown as the bill's Sign step, from
  // the server's expires_at, ticking each second while a sent bill waits.
  const [now, setNow] = useState(() => Date.now());
  const waiting = tab !== null && tab.status !== "cancelled" && tab.status !== "expired" && !(tab.status === "paid" && tab.verified_at);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting]);
  const secs = tab ? Math.max(0, Math.ceil((Date.parse(tab.expires_at) - now) / 1000)) : 0;
  const countdown = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  async function cancel() {
    if (busy) return;
    setError(null);
    if (!tab) {
      clearGuestDraft(placeId);
      setConfirm(false);
      onCancelled(null);
      return;
    }
    setBusy(true);
    try {
      await apiCancelTab(getSupabase(), tab.tab_id, "cancel");
      forgetGuestTab(tab.tab_id);
      clearGuestDraft(tab.place.id);
      setConfirm(false);
      onCancelled(tab.tab_id);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      setError((code && TAB_REFUSAL[code]) || NETWORK_FAILURE);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="border-amber-200 bg-amber-50 text-amber-900" data-pay-open-bill>
      <div className="flex items-center gap-3 px-4 pt-4">
        <PlacePhoto place={{ photo: listed?.photo ?? null, name }} className="h-11 w-11" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{name ?? "Your bill"}</span>
          <span className="block truncate text-sm text-amber-800">{what}</span>
        </span>
      </div>
      {waiting ? (
        <p className="flex items-center gap-2 px-4 pt-3 text-sm" role="timer" aria-live="off" data-pay-open-bill-timer>
          <Clock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <span className="text-base font-semibold text-amber-700 tabular-nums">{countdown}</span>
          <span className="text-amber-800">left to sign · if not, it cancels and nothing is charged</span>
        </p>
      ) : null}
      {bill ? (
        <div className="mt-4 divide-y divide-amber-200 border-t border-amber-200 text-base">
          <BillRow label="Bill" value={money(bill, currency)} />
          {tip ? (
            <>
              <BillRow label="Tip" value={money(tip, currency)} />
              <BillRow label="Total" value={money(bill + tip, currency)} strong />
            </>
          ) : null}
        </div>
      ) : null}
      <p className={cn("px-4 text-sm text-amber-900", bill ? "pt-1" : "pt-4")} data-pay-open-bill-warning>
        Finish or cancel this bill before you start a new one.
      </p>
      {error ? (
        <p role="alert" className="px-4 pt-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      {/* ONE ROW, LEFT AND RIGHT (MESITA-4130, Pato: "red cancel and black
          continue, left and right"): the Pay steps' footer shape, red Cancel
          bill a quarter, black Continue three quarters. Cancel asks first. */}
      <div className="grid grid-cols-[1fr_3fr] gap-3 p-4">
        <Button
          type="button"
          size="lg"
          variant="danger"
          className="min-h-12 w-full px-1 text-sm leading-tight font-semibold whitespace-normal"
          onClick={() => setConfirm(true)}
          disabled={busy}
          data-pay-open-bill-cancel
        >
          Cancel bill
        </Button>
        <Button asChild size="lg" className="min-h-12 w-full text-base font-semibold">
          <Link href={href}>Continue bill</Link>
        </Button>
      </div>
      <LocalDialog open={confirm} onClose={() => setConfirm(false)} ariaLabel="Cancel this bill">
        <div className="p-5">
          <p className="text-base font-semibold">Cancel this bill?</p>
          <p className="text-muted-foreground mt-1 text-sm">Nothing is paid.</p>
          <CancelBillButtons busy={busy} disabled={busy} onCancel={() => void cancel()} onKeep={() => setConfirm(false)} />
        </div>
      </LocalDialog>
    </Panel>
  );
}

function BillRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-3 px-4", strong && "font-semibold")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
