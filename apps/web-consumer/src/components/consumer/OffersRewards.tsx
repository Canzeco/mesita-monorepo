"use client";

// THE REWARDS TAB (Pato, 2026-11-23, MESITA-4710: "THIS MUST HAVE 3
// SUBPAGES — Prepay. Checkout. Rewards."; d1a): what the guest earned at
// this place, the cashback and the bonuses, newest first. The place screen
// package draws the tab and hands this body a way to switch tabs; the read
// is the app's: the guest's wallet (consumer-web-get-wallet), shared with
// Tickets and the Loyalty Card through the screen cache, narrowed to this
// place. It carries the wallet's newest 1000 entries across places, the
// same cap the Loyalty Card has.
//
// Rows are Tickets' rows (ActivityRow) with the Loyalty Card's words
// ("Cashback", "Bonus"), and open nothing: Offers never links to the card
// (MESITA-4633).

import { useCallback, useState } from "react";
import { readyClock, type OffersTab } from "@mesita/place-profile";
import { ActivityRow, ActivityRows, ActivityRowsSkeleton, type ActivityItem } from "@/components/consumer/activity/ActivityRow";
import { EFError } from "@/lib/api/_invoke";
import { apiGetWallet, entryDate, entryLabel, money, WALLET_CACHE_KEY, type Wallet, type WalletEntry } from "@/lib/api/wallet";
import { requestSignIn } from "@/lib/anonymous";
import { useViewer } from "@/lib/identity-context";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";
import { groupEntries, groupKeys } from "@/lib/wallet-entries";

const EARNED = new Set(["cashback", "bonus"]);

/** The wallet read behind Rewards. `open` turns it on the first time the
 *  tab opens in a visit (on load too); ttl 0 revalidates then, so a bill
 *  paid a minute ago shows: cached rows paint at once, fresh rows replace
 *  them. Switching tabs after that reads nothing; Retry reads again. */
export function useRewardsRead(open: boolean) {
  const viewer = useViewer();
  const getSupabase = useLazyBrowserSupabase();
  // A 401 means signed out, not a failure.
  const [unauthorized, setUnauthorized] = useState(false);
  const signedOut = viewer === "anonymous" || unauthorized;
  const wallet = useCachedQuery<Wallet>(
    open && !signedOut ? WALLET_CACHE_KEY : null,
    () =>
      apiGetWallet(getSupabase()).catch((e: unknown) => {
        if (e instanceof EFError && e.status === 401) setUnauthorized(true);
        throw e;
      }),
    { ttl: 0 },
  );
  return { signedOut, wallet };
}

export type RewardsRead = ReturnType<typeof useRewardsRead>;

/** One status per row (MESITA-4710): Refunded wins (a bonus whose purchase
 *  has a reversal here, pending or not; MVP cashback is never taken back),
 *  then Pending · ready <time>, Ready soon once that time has passed, Ready. */
function rewardStatus(e: WalletEntry, reversed: Set<string>): { status: ActivityItem["status"]; refunded: boolean; pending: boolean } {
  if (e.kind === "bonus" && e.purchase_id && reversed.has(e.purchase_id)) {
    return { status: { label: "Refunded", tone: "grey" }, refunded: true, pending: false };
  }
  if (e.pending) {
    const at = e.available_at ? Date.parse(e.available_at) : NaN;
    if (Number.isNaN(at)) return { status: { label: "Pending", tone: "ink" }, refunded: false, pending: true };
    if (at <= Date.now()) return { status: { label: "Ready soon", tone: "ink" }, refunded: false, pending: true };
    const clock = readyClock(e.available_at as string);
    return { status: { label: clock ? `Pending · ready ${clock}` : "Pending", tone: "ink" }, refunded: false, pending: true };
  }
  return { status: { label: "Ready", tone: "green" }, refunded: false, pending: false };
}

/** This place's cashback and bonus rows, newest first. */
function rewardRows(w: Wallet, placeId: string, photo: string | null): ActivityItem[] {
  const b = w.balances.find((x) => x.place_id === placeId);
  if (!b) return [];
  const reversed = new Set(b.entries.filter((e) => e.kind === "reversal" && e.purchase_id).map((e) => e.purchase_id as string));
  const kept = groupEntries(b.entries)
    .filter((g) => EARNED.has(g.kind))
    .sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  const keys = groupKeys(kept);
  return kept.map((g, i) => {
    const s = rewardStatus(g, reversed);
    return {
      key: keys[i],
      place: entryLabel(g),
      photo: b.place?.photo ?? photo,
      status: s.status,
      big: money(g.amount_cents, b.currency),
      money: true,
      sign: "+",
      line: entryDate(g.at),
      dim: s.refunded,
      // Still landing is blue, as on Tickets (MESITA-4625).
      landing: s.pending,
    };
  });
}

export function OffersRewards({
  placeId,
  photo,
  read,
  cashbackPct,
  bonusPct,
  profileFailed,
  onRetryProfile,
  switchTab,
}: {
  placeId: string;
  photo: string | null;
  read: RewardsRead;
  /** The best cashback and bonus here, the server's numbers; null when none. */
  cashbackPct: number | null;
  bonusPct: number | null;
  /** The guest's profile read failed (a session, no profile). */
  profileFailed: boolean;
  onRetryProfile: () => void;
  switchTab: (tab: OffersTab) => void;
}) {
  const { signedOut, wallet } = read;
  const retry = useCallback(() => {
    onRetryProfile();
    wallet.reload();
  }, [onRetryProfile, wallet]);

  // SIGNED OUT: one line and Sign in, no call; Sign returns to this URL.
  if (signedOut) {
    return (
      <p className="text-muted-foreground flex flex-col items-center gap-3 px-1 py-6 text-center text-sm" data-rewards-signed-out>
        Sign in to see what you earned here.
        <button
          type="button"
          onClick={() => requestSignIn(null)}
          className="bg-foreground text-background flex h-11 items-center rounded-full px-5 text-sm font-semibold"
        >
          Sign in
        </button>
      </p>
    );
  }
  if ((profileFailed || wallet.error) && !wallet.data) {
    return (
      <p className="text-muted-foreground flex flex-col items-center gap-2 px-1 py-6 text-center text-sm" role="alert" data-rewards-error>
        Couldn&apos;t load your rewards
        <button type="button" onClick={retry} className="text-foreground min-h-9 font-semibold underline underline-offset-2">
          Retry
        </button>
      </p>
    );
  }
  if (!wallet.data) return <ActivityRowsSkeleton />;

  const rows = rewardRows(wallet.data, placeId, photo);
  if (rows.length > 0) {
    // A list of only refunded rows still shows those rows.
    return (
      <ActivityRows title="Earned here" data-rewards>
        {rows.map((t) => (
          <ActivityRow key={t.key} t={t} />
        ))}
      </ActivityRows>
    );
  }

  // NOTHING EARNED YET, the main state at launch (cashback started earning
  // 2026-11-23): the two ways to earn here, each switching tabs in place. A
  // way with no number (no cashback here, nothing on sale) is left out.
  const ways: { label: string; tab: OffersTab }[] = [];
  if (cashbackPct) ways.push({ label: `Pay your bill here · up to ${cashbackPct}% back`, tab: "checkout" });
  if (bonusPct) ways.push({ label: `Prepay · up to ${bonusPct}% bonus`, tab: "prepay" });
  return (
    <div className="flex flex-col gap-3" data-rewards-empty>
      <p className="text-muted-foreground px-1 pt-1 text-sm">
        {ways.length === 2 ? "Earn here two ways." : ways.length === 1 ? "Earn here." : "Nothing earned here yet."}
      </p>
      {ways.length > 0 ? (
        <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
          {ways.map((w) => (
            <li key={w.tab}>
              <button
                type="button"
                onClick={() => switchTab(w.tab)}
                className="text-foreground hover:bg-muted/40 flex min-h-14 w-full items-center px-4 text-left text-base font-semibold"
                data-rewards-way={w.tab}
              >
                {w.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
