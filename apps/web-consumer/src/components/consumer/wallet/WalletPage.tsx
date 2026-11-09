"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet as WalletIcon } from "lucide-react";
import { TestBand } from "@mesita/place-profile";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { apiFillAreaPool, apiListAreaPool, type Place } from "@/lib/api/places";
import { apiGetWallet, ENTRY_LABEL, entryDate, money, type Wallet, type WalletBalance } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { WalletCard, WalletCardPanel, WalletCardSkeleton, type WalletCardModel } from "./WalletCard";

// THE WALLET IS A LIST OF CARDS (Pato, MESITA-3511, 2026-11-08: "a list of
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
const HEADING = "text-muted-foreground mt-5 mb-2 text-sm font-semibold";

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

type Row = { card: WalletCardModel; balance: WalletBalance | null };

function hasMoney(b: WalletBalance): boolean {
  return b.available_cents > 0 || b.pending_cents > 0;
}

function newestFirst(a: WalletBalance, b: WalletBalance): number {
  return b.last_at.localeCompare(a.last_at);
}

function balanceRow(b: WalletBalance, cat: Place | undefined): Row {
  const name = b.place?.name ?? cat?.name ?? "A Mesita place";
  const tap: WalletCardModel["tap"] =
    b.entries.length > 0
      ? { kind: "expand" }
      : b.place
        ? { kind: "link", href: placeHref(b.place.slug ?? b.place.id) }
        : { kind: "plain" };
  return {
    balance: b,
    card: {
      key: `${b.place_id}:${b.currency}`,
      name,
      photo: b.place?.photo ?? cat?.photos[0] ?? null,
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
    balance: null,
    card: {
      key: `${p.id}:mxn`,
      name: p.name,
      photo: p.photos[0] ?? null,
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
  const [open, setOpen] = useState<string | null>(null);
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
      noBalances: wallet.balances.length === 0,
    };
  }, [wallet, catalog]);

  const toggle = (key: string) => setOpen((o) => (o === key ? null : key));
  let shown = 0;
  const renderRows = (rows: Row[]) => (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const eager = shown++ < EAGER_CARDS;
        const isOpen = open === row.card.key;
        return (
          <div key={row.card.key}>
            <WalletCard card={row.card} open={isOpen} onToggle={() => toggle(row.card.key)} eager={eager} />
            {isOpen && row.balance ? (
              <WalletCardPanel>
                <History balance={row.balance} />
              </WalletCardPanel>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const loadingMore = WALLET_SHOWS_EVERY_PLACE && !catalogSettled;

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Wallet</h1>
      <p className="text-muted-foreground type-body mt-1">
        Your credit at each place, ready for your next visit.
      </p>
      {wallet?.test_mode ? <TestBand className="mt-3" /> : null}
      {wallet?.settling ? (
        <p className="text-muted-foreground mt-3 text-sm" role="status">
          Confirming a payment…
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        {groups ? (
          groups.credit.length === 0 && groups.every.length === 0 && !loadingMore ? (
            <div className="mt-5 flex flex-1 flex-col">
              <EmptyState
                icon={WalletIcon}
                title="No credit yet"
                description="Tap Prepay on a place to buy one. The credit shows up here."
                action={{ label: "Find a place", href: CONSUMER_ROUTES.home }}
              />
            </div>
          ) : (
            <>
              {groups.credit.length > 0 ? (
                <section>
                  <h2 className={HEADING}>Your credit</h2>
                  {renderRows(groups.credit)}
                </section>
              ) : null}
              {groups.every.length > 0 || loadingMore ? (
                <section>
                  <h2 className={HEADING}>Every place</h2>
                  {groups.noBalances ? (
                    <p className="text-muted-foreground -mt-1 mb-3 text-sm">
                      Buy credit on a place&apos;s Offers to pay with it here.
                    </p>
                  ) : null}
                  {renderRows(groups.every)}
                  {loadingMore ? (
                    <div className={groups.every.length > 0 ? "mt-3" : undefined}>
                      <WalletCardSkeleton count={1} />
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          )
        ) : failed ? (
          <div className="mt-5 flex flex-1 flex-col">
            <EmptyState
              icon={WalletIcon}
              title="Couldn't load Wallet"
              description="Check your connection and try again."
              action={{ label: "Try again", onClick: () => setNonce((n) => n + 1) }}
            />
          </div>
        ) : (
          <div className="mt-5">
            <WalletCardSkeleton />
          </div>
        )}
      </div>
    </div>
  );
}

/** One place's history under its open card: today's entries, then the place. */
function History({ balance }: { balance: WalletBalance }) {
  return (
    <>
      <ul>
        {balance.entries.map((e, i) => {
          const row = (
            <>
              <span>
                {ENTRY_LABEL[e.kind] ?? e.kind}
                <span className="text-muted-foreground"> · {entryDate(e.at)}</span>
              </span>
              <span className="font-semibold tabular-nums">
                {e.amount_cents > 0 ? "+" : ""}
                {money(e.amount_cents, balance.currency)}
                {e.pending ? <span className="text-muted-foreground font-normal"> · pending</span> : null}
              </span>
            </>
          );
          return (
            <li key={i}>
              {e.kind === "spend" && e.payment_id ? (
                <Link
                  href={`${CONSUMER_ROUTES.pay}?payment=${encodeURIComponent(e.payment_id)}`}
                  className="flex items-center justify-between py-2 text-sm underline-offset-4 hover:underline"
                >
                  {row}
                </Link>
              ) : (
                <div className="flex items-center justify-between py-2 text-sm">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      {balance.place ? (
        <Link
          href={placeHref(balance.place.slug ?? balance.place.id)}
          className="mt-1 block py-2 text-sm font-semibold underline-offset-4 hover:underline"
        >
          Open place
        </Link>
      ) : null}
    </>
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
