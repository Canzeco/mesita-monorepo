"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ReceiptText, Wallet as WalletIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TestBand } from "@mesita/place-profile";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { apiFillAreaPool, apiListAreaPool, type Place } from "@/lib/api/places";
import { apiGetWallet, money, type WaitingStory, type Wallet, type WalletBalance } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { WalletCard, type WalletCardModel } from "./WalletCard";
import { AddTile, CheckoutMethodTile, RAIL_TILE, RailSkeleton, StoryTile, WalletRail } from "./WalletRails";

// TWO RAILS SINCE MESITA-3530 (Pato, 2026-11-09: "add some header to the
// page called Wallet, and then at the right that icon for transactions ...
// TWO HORIZONTAL CAROUSELS with cards. only that in that page"): the header
// (Wallet, and Transactions on the right), then Money Payment Methods and
// Credits Payment Methods, each led by Add (WalletRails). A card's history
// lives in Me › Transactions now; a credit card opens its place.
//
// Before: THE WALLET IS A LIST OF CARDS (Pato, MESITA-3511, 2026-11-08: "a list of
// all your cards, using card dimensions and mentioning how much you have on
// each"). The bar's Wallet tab, /wallet: one house card per place
// (`WalletCard`). "Your credit" holds the places where the guest has money
// now or on its way (newest first); "Every place" holds the rest: $0
// balances that still have history, then, for now, every catalog place.
// Money comes from consumer-web-get-wallet only; this screen never adds
// anything up (MESITA-3098).
//
// Checkout comes back here with `?prepay=<session>`: the read credits it,
// the toast says what the server said, and the parameter is dropped so a
// reload does not ask again. While the server is still confirming a
// purchase (`settling`) the page says so and asks again. A card with
// history opens it under the card; a "Paid" row opens that payment's proof
// on Pay (MESITA-3304). In test mode the TestBand leads the page.

/**
 * FOR THE MOMENT every catalog place gets a card (Pato: "for the moment,
 * add all the cards"). The later rule keeps only places that take Mesita
 * Pay where the guest holds credit or has history: a client filter on
 * `mesita_pay`, but today `mesita_pay` and `boost_tier` (the two name marks)
 * come from the catalog row, so `false` here (balance rows only, no catalog
 * read) also drops the marks. The follow-up moves both fields onto
 * consumer-web-get-wallet's `place` first. The catalog is filled in chunks
 * of 100, one after another (~310 ms each, Vercel to Supabase): past about
 * 300 places, fill on scroll as CatalogRails does.
 */
const WALLET_SHOWS_EVERY_PLACE = true;

const PREPAY_PARAM = "prepay";
/** A purchase the server is still confirming is asked about again. */
const SETTLING_RETRY_MS = 4_000;
/** `consumer-web-list-catalog` takes at most 100 ids per fill. */
const FILL_CHUNK = 100;
/** Photos of the first cards load eagerly; the rest lazily. */
const EAGER_CARDS = 3;

function sayOutcome(w: Wallet) {
  switch (w.outcome) {
    case "credited":
    case "already_paid":
      toast.success("Added to your balance.");
      return;
    case "expired":
      toast("Checkout cancelled. Nothing was charged.");
      return;
    case "pending":
      toast("Confirming your payment…");
      return;
    default:
      return;
  }
}

type Row = { card: WalletCardModel };

function hasMoney(b: WalletBalance): boolean {
  return b.available_cents > 0 || b.pending_cents > 0;
}

function newestFirst(a: WalletBalance, b: WalletBalance): number {
  return b.last_at.localeCompare(a.last_at);
}

function balanceRow(b: WalletBalance, cat: Place | undefined): Row {
  const name = b.place?.name ?? cat?.name ?? "A Mesita place";
  // In a rail a card cannot unfold its history (Me › Transactions has it):
  // it opens the place, where its Offers are.
  const tap: WalletCardModel["tap"] = b.place
    ? { kind: "link", href: placeHref(b.place.slug ?? b.place.id) }
    : cat
      ? { kind: "link", href: placeHref(cat.slug || cat.id) }
      : { kind: "plain" };
  return {
    card: {
      key: `${b.place_id}:${b.currency}`,
      name,
      photo: b.place?.photo ?? cat?.profile_photo ?? cat?.photos[0] ?? null,
      tier: cat?.boost_tier ?? null,
      mesitaPay: cat?.mesita_pay === true,
      currency: b.currency,
      available_cents: b.available_cents,
      pending_cents: b.pending_cents,
      hasBalance: true,
      tap,
    },
  };
}

function catalogRow(p: Place): Row {
  return {
    card: {
      key: `${p.id}:mxn`,
      name: p.name,
      photo: p.profile_photo ?? p.photos[0] ?? null,
      tier: p.boost_tier ?? null,
      mesitaPay: p.mesita_pay === true,
      currency: "mxn",
      available_cents: 0,
      pending_cents: 0,
      hasBalance: false,
      tap: { kind: "link", href: placeHref(p.slug || p.id) },
    },
  };
}

export function WalletPage() {
  const getSupabase = useLazyBrowserSupabase();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [story, setStory] = useState<WaitingStory | null>(null);
  const [catalog, setCatalog] = useState<Place[]>([]);
  const [catalogSettled, setCatalogSettled] = useState(!WALLET_SHOWS_EVERY_PLACE);

  // Balances: on mount, on Try again, and again while a purchase settles.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const params = new URLSearchParams(window.location.search);
    const session = params.get(PREPAY_PARAM) ?? undefined;
    if (session) {
      params.delete(PREPAY_PARAM);
      const q = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
    void apiGetWallet(getSupabase(), session)
      .then((w) => {
        if (cancelled) return;
        setWallet(w);
        setFailed(false);
        if (session) sayOutcome(w);
        // Still confirming: ask once more after a moment.
        if (w.settling || (session && w.outcome === "pending")) {
          timer = setTimeout(() => {
            if (!cancelled) setNonce((n) => n + 1);
          }, SETTLING_RETRY_MS);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Every place, once per mount: the ranked ids and their first page, then
  // the rest in chunks of 100, appended in order. Any failure keeps the
  // cards that came and settles.
  useEffect(() => {
    if (!WALLET_SHOWS_EVERY_PLACE) return;
    let cancelled = false;
    const append = (more: readonly Place[]) =>
      setCatalog((c) => {
        const seen = new Set(c.map((p) => p.id));
        return c.concat(more.filter((p) => !seen.has(p.id)));
      });
    void (async () => {
      try {
        const pool = await apiListAreaPool(getSupabase(), null);
        if (cancelled) return;
        append(pool.places);
        const have = new Set(pool.places.map((p) => p.id));
        const rest = pool.order.filter((id) => !have.has(id));
        for (let i = 0; i < rest.length; i += FILL_CHUNK) {
          const got = await apiFillAreaPool(getSupabase(), null, [], rest.slice(i, i + FILL_CHUNK));
          if (cancelled) return;
          append(got);
        }
      } catch (e) {
        console.warn("[wallet] every-place read stopped", e);
      } finally {
        if (!cancelled) setCatalogSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Groups are derived, never stored: a balance that appears on a settling
  // retry takes its place's card out of "Every place" on the next render.
  const groups = useMemo(() => {
    if (!wallet) return null;
    const byId = new Map(catalog.map((p) => [p.id, p]));
    const credit = wallet.balances.filter(hasMoney).sort(newestFirst);
    const rest = wallet.balances.filter((b) => !hasMoney(b)).sort(newestFirst);
    const balanceIds = new Set(wallet.balances.map((b) => b.place_id));
    return {
      credit: credit.map((b) => balanceRow(b, byId.get(b.place_id))),
      every: [
        ...rest.map((b) => balanceRow(b, byId.get(b.place_id))),
        ...catalog.filter((p) => !balanceIds.has(p.id)).map(catalogRow),
      ],
    };
  }, [wallet, catalog]);

  const loadingMore = WALLET_SHOWS_EVERY_PLACE && !catalogSettled;
  let shown = 0;
  const credits = groups ? [...groups.credit, ...groups.every] : [];

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8">
      {/* THE HEADER (MESITA-3530): Wallet, and Transactions on the right. */}
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Wallet</h1>
        <Link
          href={CONSUMER_ROUTES.mePages.transactions}
          aria-label="Transactions"
          className="border-border bg-card hover:bg-muted flex h-11 w-11 items-center justify-center rounded-xl border transition"
          data-wallet-transactions
        >
          <ReceiptText className="h-5 w-5" aria-hidden />
        </Link>
      </header>
      {wallet?.test_mode ? <TestBand className="mt-3" /> : null}
      {wallet?.settling ? (
        <p className="text-muted-foreground mt-3 text-sm" role="status">
          Confirming a payment…
        </p>
      ) : null}

      <WalletRail title="Money Payment Methods">
        <AddTile
          label="Add"
          line="Saving a card comes soon"
          onClick={() => toast("Saving a card comes soon. Today you pick card, Apple Pay or Google Pay at checkout.")}
        />
        <CheckoutMethodTile />
      </WalletRail>

      <WalletRail title="Credits Payment Methods">
        <AddTile label="Add" line="Buy credits on a place's Offers" href={CONSUMER_ROUTES.home} />
        {wallet?.waiting_stories?.map((s) => <StoryTile key={s.purchase_id} story={s} onOpen={() => setStory(s)} />)}
        {credits.map((row) => (
          <div key={row.card.key} className={RAIL_TILE}>
            <WalletCard card={row.card} eager={shown++ < EAGER_CARDS} />
          </div>
        ))}
        {!groups && !failed ? <RailSkeleton /> : null}
        {groups && loadingMore ? <RailSkeleton count={1} /> : null}
      </WalletRail>

      {failed && !wallet ? (
        <div className="mt-5 flex flex-1 flex-col">
          <EmptyState
            icon={WalletIcon}
            title="Couldn't load Wallet"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: () => setNonce((n) => n + 1) }}
          />
        </div>
      ) : null}

      <LocalDialog open={story !== null} onClose={() => setStory(null)} ariaLabel="Story voucher activation">
        {story ? <WaitingStoryCard story={story} /> : null}
      </LocalDialog>
    </div>
  );
}

/** A STORY WAITING FOR STAFF (MESITA-3507, Pato: "first buy it, then ...
 *  activate it by posting an instagram story tagging the place and showing
 *  it [to] the waiter"): paid, no credit yet. The QR opens the staff page on
 *  visit.mesita.ai, where staff see the story and tap Activate. */
function WaitingStoryCard({ story }: { story: WaitingStory }) {
  const name = story.place?.name ?? "this place";
  return (
    <section className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border p-4 text-center">
      <div>
        <h2 className="text-sm font-semibold">Activate your Story voucher at {name}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {money(story.credit_cents, story.currency)} of credit waits for step 2: post an Instagram story at the
          place, tag it, and show the story and this QR to the staff.
        </p>
      </div>
      <QRCodeSVG value={story.url} size={176} marginSize={0} aria-label="Story voucher activation code" />
    </section>
  );
}

/** The old card of rows' bones, kept for Transactions (Me › Transactions). */
export function WalletSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Fragment key={i}>
          {i > 0 && <RowDivider />}
          <div className="flex min-h-16 items-center gap-3 px-4 py-3">
            <Skeleton className="h-11 w-11 rounded-lg" />
            <span className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1.5 h-3 w-20" />
            </span>
            <Skeleton className="h-5 w-16" />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
