"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiSetShare, apiSplitTab, apiUnsplitTab, equalShare, joinUrl, TAB_REFUSAL, type GuestTab } from "@/lib/api/tab";
import { money } from "@/lib/api/wallet";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { FIELD_CLASS, NETWORK_FAILURE, QUIET_BUTTON_CLASS } from "./pay-common";

// FRIENDS SPLIT ONE BILL (MESITA-3695). The waiter bills the table once.
//
// - On a whole bill: "Split with friends" opens a sheet: Equal 2 · 3 · 4 ·
//   5 · 6 or an amount. Confirm makes the bill the table and opens the
//   guest's own share (the screen below pays it like any bill).
// - On a share: one card above the pay screen: the table's bill, what is
//   paid and left, "Your share $X" with Change while it is not paying, and
//   for the guest who split it the friends' QR (/pay/join/<token>; each Show
//   rotates it, shares already taken stay) and "Pay the whole bill instead"
//   while nobody has paid.
//
// Every amount is the server's; this only proposes.

const WAYS = [2, 3, 4, 5, 6] as const;

function refusal(e: unknown): string {
  return e instanceof EFError && e.code ? (TAB_REFUSAL[e.code] ?? e.message) : NETWORK_FAILURE;
}

/** The whole bill's door to splitting it. */
export function SplitButton({
  tab,
  getSupabase,
  onSplit,
}: {
  tab: GuestTab;
  getSupabase: () => Parameters<typeof apiSplitTab>[0];
  /** The guest's share and the friends' join token. */
  onSplit: (shareTabId: string, joinToken: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ways, setWays] = useState<number | "amount">(2);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const bill = tab.bill_cents ?? 0;
  const typed = readAmount(amount);
  const share = ways === "amount" ? typed : equalShare(bill, ways);
  const valid = share !== null && share > 0 && share <= bill;

  async function confirm() {
    if (!valid || share === null) return;
    setBusy(true);
    try {
      // "An amount" still needs a count for friends' default share: two.
      const r = await apiSplitTab(getSupabase(), { tab_id: tab.tab_id, ways: ways === "amount" ? 2 : ways, share_cents: share });
      setOpen(false);
      onSplit(r.share_tab_id, r.join_token);
    } catch (e) {
      toast(refusal(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="border-border flex h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-semibold"
        onClick={() => setOpen(true)}
        data-split-with-friends
      >
        Split with friends
        <span aria-hidden>›</span>
      </button>
      <LocalSheet open={open} onClose={() => setOpen(false)} ariaLabel="Split the bill with friends">
        <div className="px-4 pt-2 pb-6">
          <p className="font-display text-2xl font-semibold">Split {money(bill, tab.currency)}</p>
          <p className="text-muted-foreground mt-1 text-sm">You pay your share; friends scan your screen to pay theirs.</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {WAYS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={ways === n}
                onClick={() => setWays(n)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-2xl border",
                  ways === n ? "border-foreground bg-muted/60 border-2" : "border-border",
                )}
              >
                <span className="text-base font-semibold">{n} people</span>
                <span className="text-muted-foreground text-sm tabular-nums">{money(equalShare(bill, n), tab.currency)} each</span>
              </button>
            ))}
            <button
              type="button"
              aria-pressed={ways === "amount"}
              onClick={() => setWays("amount")}
              className={cn(
                "flex min-h-14 items-center justify-center rounded-2xl border text-base font-semibold",
                ways === "amount" ? "border-foreground bg-muted/60 border-2" : "border-border",
              )}
            >
              An amount
            </button>
          </div>
          {ways === "amount" ? (
            <label className="mt-4 block text-sm font-semibold">
              Your share
              <input
                className={cn(FIELD_CLASS, "mt-1")}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          ) : null}
          <Button size="lg" className="mt-5 w-full text-base font-semibold" disabled={!valid || busy} onClick={() => void confirm()}>
            {busy ? "Splitting…" : valid ? `Pay my share · ${money(share, tab.currency)}` : "Choose your share"}
          </Button>
        </div>
      </LocalSheet>
    </>
  );
}

/** A share's card: the table, the guest's share, the friends' QR. */
export function ShareCard({
  tab,
  joinToken,
  getSupabase,
  onJoinToken,
  onWhole,
  onChanged,
}: {
  tab: GuestTab;
  joinToken: string | null;
  getSupabase: () => Parameters<typeof apiSplitTab>[0];
  onJoinToken: (token: string) => void;
  /** Splitting stopped: the guest pays the table. */
  onWhole: (tableId: string) => void;
  onChanged: () => void;
}) {
  const table = tab.table;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  if (!table) return null;
  const mine = tab.bill_cents ?? 0;
  const canChange = tab.status === "billed";
  const nobodyPaid = table.taken_cents === 0;
  const friendsCount = Math.max(table.shares.length - 1, 0);

  async function showQr() {
    if (!table) return;
    setBusy(true);
    try {
      const r = await apiSplitTab(getSupabase(), { tab_id: table.tab_id, ways: table.ways ?? 2, share_cents: mine });
      onJoinToken(r.join_token);
    } catch (e) {
      toast(refusal(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function saveShare() {
    const cents = readAmount(amount);
    if (cents === null || cents <= 0) return;
    setBusy(true);
    try {
      await apiSetShare(getSupabase(), tab.tab_id, cents);
      setEditing(false);
      setAmount("");
      onChanged();
    } catch (e) {
      const left = e instanceof EFError ? (e.body?.left_cents as number | undefined) : undefined;
      toast(left !== undefined ? `Only ${money(left, tab.currency)} is left` : refusal(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function whole() {
    if (!table) return;
    setBusy(true);
    try {
      await apiUnsplitTab(getSupabase(), table.tab_id);
      onWhole(table.tab_id);
    } catch (e) {
      toast(refusal(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-1" data-share-card>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold">Split bill · {money(table.bill_cents, tab.currency)}</p>
        <p className="text-muted-foreground text-sm tabular-nums" role="status" aria-live="polite">
          {table.status === "paid" ? "All paid" : `${money(table.left_cents, tab.currency)} left`}
        </p>
      </div>
      <p className="text-muted-foreground mt-1 text-sm tabular-nums">
        Paid {money(table.paid_cents, tab.currency)} · {friendsCount === 0 ? "no friends yet" : friendsCount === 1 ? "1 friend" : `${friendsCount} friends`}
      </p>

      <div className="border-border mt-3 flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-base font-semibold tabular-nums">Your share {money(mine, tab.currency)}</p>
        {canChange && !editing ? (
          <button type="button" className="min-h-11 text-sm font-semibold underline" onClick={() => setEditing(true)}>
            Change
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            className={cn(FIELD_CLASS, "flex-1")}
            inputMode="decimal"
            autoComplete="off"
            placeholder={(mine / 100).toString()}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Your share"
          />
          <Button disabled={busy || readAmount(amount) === null} onClick={() => void saveShare()}>
            Save
          </Button>
        </div>
      ) : null}

      {table.mine && table.status === "billed" ? (
        <div className="border-border mt-3 border-t pt-3">
          {joinToken ? (
            <div className="flex flex-col items-center text-center">
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={joinUrl(window.location.origin, joinToken)} size={200} marginSize={0} aria-label="Friends scan to pay their share" data-join-qr />
              </div>
              <p className="mt-3 text-sm font-semibold">Friends scan with their camera to pay their share</p>
            </div>
          ) : (
            <button type="button" className={QUIET_BUTTON_CLASS} disabled={busy} onClick={() => void showQr()}>
              Show friends&apos; QR
            </button>
          )}
          {nobodyPaid && canChange ? (
            <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-2")} disabled={busy} onClick={() => void whole()}>
              Pay the whole bill instead
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
