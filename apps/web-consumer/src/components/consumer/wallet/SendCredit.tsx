"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Screen } from "@/components/consumer/nav/Screen";
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
  WALLET_CACHE_KEY,
} from "@/lib/api/wallet";
import { CONSUMER_ROUTES, walletPlacePath } from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import { invalidateCached } from "@/lib/screen-cache";
import { placeHref } from "@/lib/place-route";
import { copyToClipboard, shareOrCopy } from "@/lib/share-place";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/shared/Skeleton";
import { GIFT_PENDING } from "@/lib/wallet-card";
import { AmountDisplay, AmountKeypad } from "@/components/consumer/pay/AmountKeypad";
import { PaySection } from "@/components/consumer/pay/pay-flow";
import { pressKey } from "@/lib/pay-keypad";
import { GiftCardFace } from "./GiftCardFace";
import { PlacePhotoMark } from "./PlaceCredit";
import { useWallet } from "./use-wallet";
import { prepayHref } from "./WalletPickers";

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

/** /wallet/place/<placeId>/send — the sender's page (MESITA-4096; it was a
 *  sheet over the Loyalty Card): an amount, Send, then the link to share once.
 *  Not enough to send here (nothing spendable, more typed than spendable, or
 *  the server's `insufficient`): a Buy Credits button to the place's prepay
 *  page (Pato: "if not enough money, add shortcut button to redirect to
 *  prepay"). */
export function SendCreditPage({ placeId }: { placeId: string }) {
  const getSupabase = useLazyBrowserSupabase();
  const router = useRouter();
  const { wallet, credits, reread } = useWallet();
  const row = credits?.find((r) => r.placeId === placeId) ?? null;
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [short, setShort] = useState(false);
  const [link, setLink] = useState<{ url: string; cents: number } | null>(null);
  // One request id per amount: a retry after a lost answer replays, never sends twice.
  const attempt = useRef<{ id: string; cents: number } | null>(null);

  // No Loyalty Card here: the send list is the nearest true screen.
  useEffect(() => {
    if (credits && !row) navigateTo(router, CONSUMER_ROUTES.walletSend, { replace: true });
  }, [credits, row, router]);

  if (!row || !wallet) {
    return (
      <Screen title="Send Gift" paper>
        <div className="flex flex-col items-center pt-6" aria-busy>
          <Skeleton className="h-5 w-56 max-w-full" />
          <Skeleton className="mt-6 h-12 w-60 max-w-full" />
          <Skeleton className="mt-8 h-12 w-full rounded-xl" />
        </div>
      </Screen>
    );
  }

  const placeName = row.card.name;
  const currency = row.card.currency;
  const spendableCents = row.balance.spendable_cents ?? 0;
  const gone = row.balance.place === null;
  const buy = gone ? null : prepayHref(row.placeSlug);
  const canSend = wallet.can_send === true && !gone;
  const typed = readAmount(amount);
  const over = typed !== null && typed > spendableCents;

  function done() {
    goBack(router, walletPlacePath(placeId));
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
    setShort(false);
    try {
      const r = await apiSendCredit(getSupabase(), { place_id: placeId, amount_cents: cents, request_id: attempt.current.id });
      attempt.current = null;
      invalidateCached(WALLET_CACHE_KEY);
      reread();
      if (r.token) setLink({ url: giftLink(r.token), cents: r.amount_cents });
      else {
        // A replay: the link went out on the first answer, which was lost.
        toast("Sent. If you lost the link, take it back and send again.");
        done();
      }
    } catch (err) {
      if (err instanceof EFError && err.code) attempt.current = null;
      setShort(err instanceof EFError && err.code === "insufficient");
      setError(refusal(err, "Couldn't send. Try again.", currency));
    } finally {
      setBusy(false);
    }
  }

  const copyLink = async (url: string) => {
    if (await copyToClipboard(url)) toast.success("Link copied");
    else toast.error("Couldn't copy the link");
  };

  // PACKED (MESITA-4333, Pato: "not sending, but pack them … then send the
  // gift to one friend"): the gift card, one line on what happens, Send to a
  // friend (the phone's share sheet), and a quiet Copy link · Done. The link
  // still shows only once, so this screen is the only way to it.
  if (link) {
    const amountText = money(link.cents, currency);
    return (
      <Screen title="Send Gift" paper>
        <div className="flex flex-col items-center pt-6 text-center" data-send-credit-packed>
          <GiftCardFace name={placeName} photo={row.card.photo} amount={amountText} />
          <h2 className="font-display mt-8 text-2xl font-semibold tracking-tight">Packed! Send it to one friend.</h2>
          <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
            The first to open it gets it. Until then you can take it back.
          </p>
          <button
            type="button"
            className={`${PRIMARY} mt-8`}
            onClick={() =>
              void shareOrCopy(
                { title: "A Mesita gift card", text: `${amountText} to spend at ${placeName}`, url: link.url },
                { text: link.url, copied: "Link copied", failed: "Couldn't copy the link" },
              )}
            data-send-credit-share
          >
            Send to a friend
          </button>
          <div className="text-muted-foreground mt-3 flex items-center gap-1 text-sm font-semibold">
            <button type="button" className="hover:text-foreground px-2 py-2 transition" onClick={() => void copyLink(link.url)}>
              Copy link
            </button>
            <span aria-hidden>·</span>
            <button type="button" className="hover:text-foreground px-2 py-2 transition" onClick={done}>
              Done
            </button>
          </div>
        </div>
      </Screen>
    );
  }

  if (!canSend || spendableCents <= 0) {
    return (
      <Screen title="Send Gift" paper>
        <div className="flex flex-col pt-4" data-send-credit>
          {!canSend ? (
            <p className="text-muted-foreground pt-2 text-center text-sm">
              {gone ? "This place left Mesita, so its credit can't be sent." : "Sending credit isn't open yet."}
            </p>
          ) : (
            /* Nothing to send yet: say why, and the way to get some. */
            <>
              <p className="text-muted-foreground pt-2 text-center text-sm" data-send-credit-empty>
                {row.card.pending_cents > 0 ? GIFT_PENDING : `No credit at ${placeName} to send yet.`}
              </p>
              {buy ? (
                <Link href={buy} className={`${PRIMARY} mt-6`} data-send-credit-buy>
                  Buy Credits
                </Link>
              ) : null}
            </>
          )}
        </div>
      </Screen>
    );
  }

  // THE AMOUNT, THE BILL STEP'S WAY (MESITA-4333, Pato: "put the numbers not
  // natively … like the bill page, reuse that component … make this page
  // more beautiful"): a panel naming the place and the limit, then the Gift
  // panel with AmountDisplay over AmountKeypad (no phone keyboard), and Pack
  // in the white foot band.
  const packCents = typed ?? 0;
  return (
    <Screen
      title="Send Gift"
      paper
      footer={
        <div className="flex flex-col gap-2">
          {(over || short) && buy ? (
            <Link href={buy} className={SECONDARY} data-send-credit-buy>
              Buy Credits
            </Link>
          ) : null}
          <button type="button" className={PRIMARY} disabled={busy || over || packCents <= 0} onClick={() => void send()}>
            {busy ? "Packing…" : packCents > 0 ? `Pack ${money(packCents, currency)}` : "Pack"}
          </button>
          <p className="text-muted-foreground text-center text-xs">Into a gift card for one friend.</p>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3" data-send-credit>
        <PaySection className="flex items-center gap-3 px-4 py-3" data-send-credit-place>
          <PlacePhotoMark photo={row.card.photo} name={placeName} />
          <span className="min-w-0">
            <span className="text-muted-foreground block text-sm">Send a gift at</span>
            <span className="block truncate text-base font-semibold">{placeName}</span>
            <span className="text-muted-foreground block text-sm tabular-nums">Up to {money(spendableCents, currency)}</span>
          </span>
        </PaySection>
        <PaySection title="Gift" className="flex min-h-0 shrink flex-col">
          <div className="flex min-h-0 shrink flex-col px-4 pb-2">
            <AmountDisplay text={amount} currency={currency} label="Gift" className="mt-1 shrink-0" />
            {error || over ? (
              <p className="text-destructive text-center text-sm" role="alert">
                {error ?? `You can send up to ${money(spendableCents, currency)} here.`}
              </p>
            ) : null}
            <div className="mt-2 flex h-64 min-h-44 shrink flex-col">
              <AmountKeypad
                text={amount}
                onKey={(k) => {
                  setAmount((t) => pressKey(t, k));
                  setError(null);
                  setShort(false);
                }}
              />
            </div>
          </div>
        </PaySection>
      </div>
    </Screen>
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
    // A panel of its own on the Loyalty Card page (MESITA-4064).
    <Panel className="mt-4" title="Waiting for a friend">
      <ul className="divide-border mt-1 divide-y pb-1" data-sent-links>
        {links.map((l) => (
          <li key={l.gift_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
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
    </Panel>
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

