"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, QrCode } from "lucide-react";
import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, apiListVisits, type GuestTab, TAB_REFUSAL } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { clearGuestDraft, readDraft } from "@/lib/guest-pay-draft";
import { readAmount } from "@mesita/place-profile/lib/money";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES, payBillPath, payPlacePath } from "@/lib/consumer-route-contract";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { forgetGuestTab, NETWORK_FAILURE, PlacePhoto, readGuestTabIds, CancelBillButtons } from "./pay-common";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { usePayLocation } from "./pay-location";
import { usePayPlaces } from "./use-pay-places";
import { usePendingTicket } from "./PendingTicketBanner";
import { PayHeader } from "./PayHeader";
import { TicketsShortcut, TicketsShortcutSkeleton } from "./TicketsShortcut";
import { WalletShareGift, WalletShareGiftSkeleton } from "@/components/consumer/wallet/WalletShareGift";
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
// Pay Bill opens /pay/pick (the place picker, a pushed page: the search bar
// and the places that were this page's own box, MESITA-4204). At a place
// (within AT_PLACE_M) it reads "Pay Bill at <place>" and opens that bill,
// "Other place" under it. With a bill open it IS the bill (the amber panel
// below). The bar is Home · Search · Pay · Me; /wallet forwards here.
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
// The location is asked on /pay/pick only (pay-location.ts); Pay uses a fix
// the browser already grants.

/** The guest is at a place this close (MESITA-3861): Pay Bill names it. */
const AT_PLACE_M = 150;

export function PayPage({
  giftToken = null,
}: {
  /** /wallet/gift/<token>: a friend's credit link opens over Pay. */
  giftToken?: string | null;
} = {}) {
  const getSupabase = useLazyBrowserSupabase();
  // Pay never asks for the location (the picker does); a fix the browser
  // already grants names the place the guest is at (MESITA-4232, D5).
  const { loc } = usePayLocation({ prime: false });
  const { places } = usePayPlaces(loc.state === "on" ? loc.at : null);
  // null while the open payment is still being looked for.
  const [openTabs, setOpenTabs] = useState<GuestTab[] | null>(null);
  // ONE PAINT (MESITA-4376): the buttons stay bones until the bills AND the
  // Wallet have read, so nothing live shows over a half-loaded page.
  const [walletReady, setWalletReady] = useState(false);
  const loaded = openTabs !== null && walletReady;
  const markWalletReady = useCallback(() => setWalletReady(true), []);

  // The guest's own payments still in progress (paying, or paid and not yet
  // signed, inside their window), read fresh each time: the one the server
  // names (MESITA-3772, any device) and this device's list (MESITA-3709). A
  // finished one is forgotten. A failed server read falls back to the list.
  useEffect(() => {
    let cancelled = false;
    const local = readGuestTabIds();
    void apiListVisits(getSupabase())
      .then((r) => pickOpenGuestPayment(r.visits, Date.now())?.tab_id ?? null)
      .catch(() => null)
      .then((serverId) => {
        const ids = serverId
          ? [serverId, ...local.filter((x) => x !== serverId)]
          : local;
        return Promise.all(
          ids.map((id) =>
            apiGetTab(getSupabase(), id)
              .then((r) => r.tab)
              .catch((e) => {
                if (
                  e instanceof EFError &&
                  (e.status === 404 || e.status === 403)
                )
                  forgetGuestTab(id);
                return null;
              }),
          ),
        );
      })
      .then((tabs) => {
        if (cancelled) return;
        const now = Date.now();
        const live = tabs.filter((t): t is GuestTab => {
          if (!t) return false;
          const open =
            !t.verified_at &&
            Date.parse(t.expires_at) > now &&
            (t.status === "paying" || t.status === "paid");
          if (!open) forgetGuestTab(t.tab_id);
          return open;
        });
        setOpenTabs(live);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AT A PLACE (MESITA-3861, reshaped by MESITA-4232 D5): the nearest place
  // within AT_PLACE_M is named on Pay Bill. It no longer opens by itself:
  // the page never moves before the guest taps.
  const pending = usePendingTicket();
  const here =
    loc.state === "on" && places
      ? (places
          .filter((p) => p.distance_m !== null && p.distance_m <= AT_PLACE_M)
          .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0))[0] ?? null)
      : null;

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
      <PayHeader title="Mesita Wallet" action={loaded ? <TicketsShortcut /> : <TicketsShortcutSkeleton />} />

      {/* PAY BILL (Pato, 2026-11-17, MESITA-4232: "GIANT BUTTON … CALL THAT
          PAY BILL"): the page's one coloured thing (Stripe purple since MESITA-4260), first. With a bill open it
          IS the bill (D4): the amber panel, Continue bill and Cancel bill. */}
      {!loaded || openTabs === null ? (
        <PayBillSkeleton />
      ) : openTabs.length > 0 || pending ? (
        <div className="mt-2 flex flex-col">
          <OpenBillPanel
            tab={openTabs[0] ?? null}
            pending={pending}
            places={places}
            onCancelled={(tabId) =>
              // A copy either way: the re-render re-reads the pending draft.
              setOpenTabs((t) => (t ? t.filter((x) => x.tab_id !== tabId) : t))
            }
          />
        </div>
      ) : (
        <PayBillButton here={here} />
      )}

      {/* The three doors under it, grey (MESITA-4232). */}
      {loaded ? <WalletShareGift /> : <WalletShareGiftSkeleton />}

      <WalletSection giftToken={giftToken} onReady={markWalletReady} />
    </KeptScroll>
  );
}

/** Pay Bill (MESITA-4232). 112px since MESITA-4272 (Pato: "qr button must be
 *  bigger, maybe double height … make it more visible"): a 36px QR stacked
 *  over "Pay Bill" at text-lg semibold. Stripe purple #635bff since MESITA-4260 (Pato:
 *  "maybe do the button purple like stripe"); A NATIVE PAY BUTTON since MESITA-4254 (Pato: "THE
 *  PAY BUTTON LOOKS LIKE SHIT … AN OLD 2010s app"; picked option A of the
 *  options page): ink black, 56px, one centred line, an 18px QR and "Pay
 *  Bill" at text-base semibold, like Apple Pay or Stripe; the page's one dark
 *  thing. It was a pink 80px slab (MESITA-4240) and black 52px before. At a
 *  place it reads "Pay Bill at <place>" and opens that place's bill, with
 *  "Other place" under it for the picker; otherwise it opens the picker
 *  (/pay/pick). */
function PayBillButton({ here }: { here: PayPlace | null }) {
  const name = here?.name ?? null;
  return (
    <div className="mt-2 flex flex-col" data-pay-bill>
      <PushLink
        href={here ? payPlacePath(here.place_id) : CONSUMER_ROUTES.payPick}
        className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl bg-[#635bff] px-4 text-white transition hover:bg-[#5249e6] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#a5a0ff] focus-visible:ring-offset-2 outline-none"
        aria-label={name ? `Pay Bill at ${name}` : "Pay Bill"}
        data-pay-bill-button
      >
        {/* The QR in a white circle (MESITA-4275, Pato: "put the qr inside a
            circle"), purple ink, like the bar's Pay tab's black circle. */}
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: "#635bff" }} aria-hidden>
          <QrCode className="h-7 w-7" strokeWidth={2.25} />
        </span>
        <span className="max-w-full min-w-0 truncate text-lg font-semibold tracking-tight">{name ? `Pay Bill at ${name}` : "Pay Bill"}</span>
      </PushLink>
      {here ? (
        <PushLink
          href={CONSUMER_ROUTES.payPick}
          className="text-muted-foreground hover:text-foreground mx-auto mt-1 flex min-h-11 items-center px-4 text-sm font-semibold transition"
          data-pay-bill-other
        >
          Other place
        </PushLink>
      ) : null}
    </div>
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
