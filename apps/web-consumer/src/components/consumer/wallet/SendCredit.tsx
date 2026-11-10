"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import {
  apiClaimGift,
  apiLookGift,
  apiSendCredit,
  apiTakeBackCredit,
  entryDate,
  GIFT_REFUSAL,
  giftLink,
  type GiftLook,
  money,
  type SentLink,
} from "@/lib/api/wallet";
import { placeHref } from "@/lib/place-route";
import { shareOrCopy } from "@/lib/share-place";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";

// SENDING CREDIT TO A FRIEND (MESITA-3292; Pato, 2026-11-06: "word of mouth
// with value attached … same place only"). A guest sends some of their
// credit at one place as a one-time link; a friend who opens it signed in
// takes it at the same place; until then the sender can take it back. Every
// amount and refusal is the server's; this screen formats, never adds.

const PRIMARY =
  "bg-foreground text-paper flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50";
const SECONDARY =
  "border-border bg-card hover:bg-muted flex h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold transition disabled:opacity-50";

function refusal(err: unknown, fallback: string, currency = "mxn"): string {
  if (err instanceof EFError) {
    if (err.code === "insufficient" && typeof err.body?.spendable_cents === "number") {
      return `You can send up to ${money(err.body.spendable_cents, currency)} here.`;
    }
    if (err.code && GIFT_REFUSAL[err.code]) return GIFT_REFUSAL[err.code];
  }
  return fallback;
}

/** The sender's form: an amount, Send, then the link to share once. */
export function SendCreditSheet({
  open,
  onClose,
  onSent,
  placeId,
  placeName,
  currency,
  spendableCents,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  placeId: string;
  placeName: string;
  currency: string;
  spendableCents: number;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; cents: number } | null>(null);
  // One request id per amount: a retry after a lost answer replays, never sends twice.
  const attempt = useRef<{ id: string; cents: number } | null>(null);

  function close() {
    setAmount("");
    setError(null);
    setLink(null);
    attempt.current = null;
    onClose();
  }

  async function send() {
    const cents = readAmount(amount);
    if (!cents) {
      setError(GIFT_REFUSAL.amount_required);
      return;
    }
    if (!attempt.current || attempt.current.cents !== cents) attempt.current = { id: crypto.randomUUID(), cents };
    setBusy(true);
    setError(null);
    try {
      const r = await apiSendCredit(getSupabase(), { place_id: placeId, amount_cents: cents, request_id: attempt.current.id });
      attempt.current = null;
      onSent();
      if (r.token) setLink({ url: giftLink(r.token), cents: r.amount_cents });
      else {
        // A replay: the link went out on the first answer, which was lost.
        toast("Sent. If you lost the link, take it back and send again.");
        close();
      }
    } catch (err) {
      if (err instanceof EFError && err.code) attempt.current = null;
      setError(refusal(err, "Couldn't send. Try again.", currency));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LocalSheet open={open} onClose={close} ariaLabel="Send credit to a friend">
      <div className="flex flex-col px-4 pt-5 pb-8" data-send-credit>
        {link ? (
          <>
            <h2 className="text-xl font-semibold">Share your link</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Whoever opens it first gets {money(link.cents, currency)} of credit at {placeName}. This link shows only
              once. Until your friend takes it, you can take it back from this card.
            </p>
            <p className="border-border bg-muted mt-4 rounded-xl border px-3 py-3 font-mono text-xs break-all">{link.url}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className={PRIMARY}
                onClick={() =>
                  void shareOrCopy(
                    { title: "Mesita credit", text: `${money(link.cents, currency)} of credit at ${placeName}`, url: link.url },
                    { text: link.url, copied: "Link copied", failed: "Couldn't copy the link" },
                  )}
              >
                Share link
              </button>
              <button type="button" className={SECONDARY} onClick={close}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Send credit to a friend</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              At {placeName} only · up to {money(spendableCents, currency)}
            </p>
            <label className="border-foreground mx-auto mt-6 flex w-60 items-baseline justify-center gap-1.5 border-b-2 pb-2" htmlFor="send-amount">
              <span className="text-muted-foreground text-4xl font-semibold">$</span>
              <input
                id="send-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="placeholder:text-muted-foreground/50 w-36 min-w-0 bg-transparent text-4xl font-semibold tabular-nums outline-none"
                aria-label="Amount to send"
              />
              <span className="text-muted-foreground text-base font-semibold">{currency.toUpperCase()}</span>
            </label>
            {error ? (
              <p className="text-destructive mt-3 text-center text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <button type="button" className={`${PRIMARY} mt-6`} disabled={busy} onClick={() => void send()}>
              {busy ? "Sending…" : "Send"}
            </button>
            <p className="text-muted-foreground mt-3 text-center text-xs">
              It leaves your balance now. You get a link to share.
            </p>
          </>
        )}
      </div>
    </LocalSheet>
  );
}

/** The links a guest sent at one place that nobody took yet. */
export function SentLinks({ links, currency, onChanged }: { links: SentLink[]; currency: string; onChanged: () => void }) {
  const getSupabase = useLazyBrowserSupabase();
  const [busy, setBusy] = useState<string | null>(null);
  if (links.length === 0) return null;

  async function takeBack(id: string) {
    setBusy(id);
    try {
      const r = await apiTakeBackCredit(getSupabase(), id);
      toast.success(`${money(r.amount_cents, r.currency)} is back in your balance.`);
      onChanged();
    } catch (err) {
      toast.error(refusal(err, "Couldn't take it back. Try again."));
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h3 className="mt-6 mb-1 text-sm font-semibold">Waiting for a friend</h3>
      <ul className="divide-border divide-y" data-sent-links>
        {links.map((l) => (
          <li key={l.gift_id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span>
              <span className="font-semibold tabular-nums">{money(l.amount_cents, currency)}</span>
              <span className="text-muted-foreground"> · sent {entryDate(l.created_at)}</span>
            </span>
            <button
              type="button"
              disabled={busy === l.gift_id}
              onClick={() => void takeBack(l.gift_id)}
              className="hover:bg-muted rounded-lg px-3 py-2 font-semibold transition disabled:opacity-50"
            >
              Take back
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** A friend's link, opened at /wallet/gift/<token>: what it holds, then Take. */
export function GiftClaimSheet({ token, onClose, onClaimed }: { token: string | null; onClose: () => void; onClaimed: () => void }) {
  const getSupabase = useLazyBrowserSupabase();
  const [look, setLook] = useState<GiftLook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiLookGift(getSupabase(), token)
      .then((g) => {
        if (!cancelled) setLook(g);
      })
      .catch((err) => {
        if (!cancelled) setError(refusal(err, "Couldn't open this link. Try again."));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function take() {
    if (!token) return;
    setBusy(true);
    try {
      const r = await apiClaimGift(getSupabase(), token);
      toast.success(`${money(r.amount_cents, r.currency)} of credit is yours.`);
      onClaimed();
    } catch (err) {
      setError(refusal(err, "Couldn't take the credit. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const name = look?.place?.name ?? "this place";
  let body: ReactNode;
  if (error) body = <p className="text-sm">{error}</p>;
  else if (!look) body = <p className="text-muted-foreground text-sm">Opening your link…</p>;
  else if (look.yours || look.status === "claimed") {
    body = <p className="text-sm">{look.yours ? `This credit is already in your Wallet at ${name}.` : GIFT_REFUSAL.claimed}</p>;
  } else if (look.status === "taken_back") body = <p className="text-sm">{GIFT_REFUSAL.taken_back}</p>;
  else if (look.mine) body = <p className="text-sm">{GIFT_REFUSAL.own_gift}</p>;
  else {
    body = (
      <>
        <p className="text-3xl font-semibold tabular-nums">{money(look.amount_cents, look.currency)}</p>
        <p className="text-muted-foreground mt-1 text-sm">of credit at {name}, from a friend. Spend it there with Pay.</p>
        <button type="button" className={`${PRIMARY} mt-6`} disabled={busy} onClick={() => void take()}>
          {busy ? "Taking…" : "Take the credit"}
        </button>
      </>
    );
  }

  return (
    <LocalSheet open={token !== null} onClose={onClose} ariaLabel="Credit from a friend">
      <div className="flex flex-col px-4 pt-5 pb-8" data-gift-claim>
        <span className="bg-muted flex h-10 w-10 items-center justify-center rounded-full" aria-hidden>
          <Gift className="h-5 w-5" />
        </span>
        <h2 className="mt-3 mb-3 text-xl font-semibold">Credit from a friend</h2>
        {body}
        {look?.place?.slug ? (
          <Link href={placeHref(look.place.slug)} className="mt-4 block py-2 text-sm font-semibold underline-offset-4 hover:underline">
            Open {name}
          </Link>
        ) : null}
      </div>
    </LocalSheet>
  );
}
