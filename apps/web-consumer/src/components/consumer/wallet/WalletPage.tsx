"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Wallet as WalletIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TestBand } from "@mesita/place-profile";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { apiGetWallet, ENTRY_LABEL, entryDate, money, type WaitingStory, type Wallet, type WalletBalance } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// THE WALLET IS THE GUEST'S CREDIT (Pato, 2026-11-01; MESITA-3098; vouchers
// since MESITA-3303). The bar's Wallet tab, /wallet (MESITA-3295): every
// place a guest holds credit at, one row per place, in one card of rows
// (Pato prefers one card of rows to tiles): the balance, a Pending line
// while a voucher's hour runs, and a tap opens that place's history under
// its row. Money comes from consumer-web-get-wallet only; this screen never
// adds anything up.
//
// Checkout comes back here with `?prepay=<session>`: the read credits it,
// the toast says what the server said, and the parameter is dropped so a
// reload does not ask again. While the server is still confirming a
// purchase (`settling`) the page says so and asks again. The Pay tab spends
// a balance (MESITA-3304); a "Paid" row opens that payment's proof there. In
// test mode the TestBand leads the page.

const PREPAY_PARAM = "prepay";
/** A purchase the server is still confirming is asked about again. */
const SETTLING_RETRY_MS = 4_000;

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

export function WalletPage() {
  const getSupabase = useLazyBrowserSupabase();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

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

      {wallet?.waiting_stories?.length ? (
        <div className="mt-5 flex flex-col gap-3" data-waiting-stories>
          {wallet.waiting_stories.map((s) => <WaitingStoryCard key={s.purchase_id} story={s} />)}
        </div>
      ) : null}

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        {wallet ? (
          wallet.balances.length === 0 && !wallet.waiting_stories?.length ? (
            <EmptyState
              icon={WalletIcon}
              title="No credit yet"
              description="Tap Prepay on a place to buy one. The credit shows up here."
              action={{ label: "Find a place", href: CONSUMER_ROUTES.home }}
            />
          ) : (
            <div className="border-border bg-card overflow-hidden rounded-2xl border">
              {wallet.balances.map((b, i) => (
                <Fragment key={`${b.place_id}:${b.currency}`}>
                  {i > 0 && <RowDivider />}
                  <BalanceRow
                    balance={b}
                    open={open === b.place_id}
                    onToggle={() => setOpen((o) => (o === b.place_id ? null : b.place_id))}
                  />
                </Fragment>
              ))}
            </div>
          )
        ) : failed ? (
          <EmptyState
            icon={WalletIcon}
            title="Couldn't load Wallet"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: () => setNonce((n) => n + 1) }}
          />
        ) : (
          <WalletSkeleton />
        )}
      </div>
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

function BalanceRow({
  balance,
  open,
  onToggle,
}: {
  balance: WalletBalance;
  open: boolean;
  onToggle: () => void;
}) {
  const name = balance.place?.name ?? "A Mesita place";
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="hover:bg-muted flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition"
      >
        {balance.place?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={balance.place.photo} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="bg-muted text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
            <WalletIcon className="h-5 w-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="text-muted-foreground block text-xs">
            {balance.pending_cents > 0
              ? `${money(balance.pending_cents, balance.currency)} pending · available within the hour`
              : `Last added ${entryDate(balance.last_at)}`}
          </span>
        </span>
        <span className="font-display shrink-0 text-lg font-semibold tabular-nums">
          {money(balance.available_cents, balance.currency)}
        </span>
        <ChevronDown
          className={cn("text-muted-foreground h-4 w-4 shrink-0 transition", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="border-border bg-muted/40 border-t px-4 py-2">
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
      )}
    </div>
  );
}

/** The card of rows as it will land: three rows, same heights. */
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
