"use client";

import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { Screen } from "@/components/consumer/nav/Screen";
import { EFError } from "@/lib/api/_invoke";
import {
  apiClaimGift,
  apiGetGiftLink,
  apiLookGift,
  apiSendCredit,
  apiTakeBackCredit,
  entryDate,
  GIFT_REFUSAL,
  giftLink,
  type GiftLook,
  money,
  WALLET_CACHE_KEY,
} from "@/lib/api/wallet";
import { CONSUMER_ROUTES, walletPlacePath } from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import { invalidateCached } from "@/lib/screen-cache";
import { placeHref } from "@/lib/place-route";
import { canShareNatively, copyToClipboard, copyWithTextarea } from "@/lib/share-place";
import { INSTAGRAM_DM_URL } from "@/lib/share-app";
import { CHANNEL_MARKS } from "@/components/consumer/share/channel-icons";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/shared/Skeleton";
import { GIFT_PENDING } from "@/lib/wallet-card";
import { AmountDisplay, AmountKeypad } from "@/components/consumer/pay/AmountKeypad";
import { PaySection } from "@/components/consumer/pay/pay-flow";
import { pressKey } from "@/lib/pay-keypad";
import { GiftCardFace, GiftCardMini } from "./GiftCardFace";
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
  const [link, setLink] = useState<{ url: string; cents: number; giftId?: string; reopened?: boolean } | null>(null);
  // OPEN GIFTS FIRST (MESITA-4390, Pato: "if i click to create gift, but i
  // already have gift oepns, like show the prev list as a prev step … select
  // current and copy or just create new gift"): `fresh` is the guest's "New
  // gift"; `opening` the open gift whose link is being read.
  const [fresh, setFresh] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  // One request id per amount: a retry after a lost answer replays, never sends twice.
  const attempt = useRef<{ id: string; cents: number } | null>(null);

  // No Loyalty Card here: the send list is the nearest true screen.
  useEffect(() => {
    if (credits && !row) navigateTo(router, CONSUMER_ROUTES.walletSend, { replace: true });
  }, [credits, row, router]);

  if (!row || !wallet) {
    return (
      <Screen title="Send Gift" paper>
        {/* THE PAGE'S SHAPE IN BONES, NO WORDS (MESITA-4352): the place
            panel, the Gift panel's amount and twelve keys, the Pack bar. */}
        <div className="flex flex-col gap-3" aria-busy>
          <Panel className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <span className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-4 w-44 rounded-md" />
              <Skeleton className="h-3.5 w-32 rounded-md" />
            </span>
          </Panel>
          <Panel className="px-4 pt-4 pb-3">
            <Skeleton className="h-5 w-12 rounded-md" />
            <Skeleton className="mx-auto mt-4 h-12 w-48 rounded-lg" />
            <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4 px-4">
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="mx-auto h-8 w-8 rounded-md" />
              ))}
            </div>
          </Panel>
          <Skeleton className="mt-3 h-12 w-full rounded-xl" />
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
      if (r.token) setLink({ url: giftLink(r.token), cents: r.amount_cents, giftId: r.gift_id });
      else {
        // A replay: the link went out on the first answer, which was lost.
        toast("Packed. It's waiting under Send Gift's open gifts.");
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

  // An open gift again: its link, read from the server (MESITA-4390). A gift
  // packed before links could be shown again has none: it can only be taken
  // back.
  async function reopen(giftId: string, cents: number) {
    setOpening(giftId);
    try {
      const r = await apiGetGiftLink(getSupabase(), giftId);
      if (r.token) setLink({ url: giftLink(r.token), cents, giftId, reopened: true });
      else toast("This gift's link can't be shown again. Take it back and pack a new one.");
    } catch (err) {
      toast.error(refusal(err, "Couldn't open this gift. Try again."));
      invalidateCached(WALLET_CACHE_KEY);
      reread();
    } finally {
      setOpening(null);
    }
  }

  async function takeBack(giftId: string) {
    setOpening(giftId);
    try {
      const r = await apiTakeBackCredit(getSupabase(), giftId);
      toast.success(`${money(r.amount_cents, r.currency)} is back in your balance.`);
      setLink(null);
    } catch (err) {
      toast.error(refusal(err, "Couldn't take it back. Try again."));
    } finally {
      setOpening(null);
      invalidateCached(WALLET_CACHE_KEY);
      reread();
    }
  }

  const copyLink = async (url: string) => {
    if (await copyToClipboard(url)) toast.success("Link copied");
    else toast.error("Couldn't copy the link");
  };

  // THE BRAND'S OWN COLOUR (MESITA-4368, Pato: "buttons of the colour of the
  // thing: Instagram pink, WhatsApp green, Copy link dark"): a filled circle,
  // the mark white on it.
  const CHANNEL_FACE = {
    whatsapp: "bg-[#25D366] [&_svg]:fill-white",
    instagram: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] [&_g]:stroke-white",
    messages: "bg-[#34C759] [&_svg]:fill-white",
    copy: "bg-foreground [&_svg]:text-white",
  } as const;

  // PACKED (MESITA-4333, Pato: "not sending, but pack them … then send the
  // gift to one friend"): the gift card, one line on what happens, Send to a
  // friend: WhatsApp · Instagram · Messages · Copy link (MESITA-4352), then Done. Since
  // MESITA-4390 an open gift's card comes back from the open-gifts step, with
  // Take it back under Done.
  if (link) {
    const amountText = money(link.cents, currency);
    const message = `A ${amountText} gift card for ${placeName} on Mesita: ${link.url}`;
    // Instagram cannot be prefilled from the web. ON A PHONE (MESITA-4392,
    // Pato: "the instagram button must work") the button opens the phone's
    // share sheet with the message: Instagram is in it and sends straight to
    // a chat. Elsewhere (a computer's sheet has no Instagram) it copies the
    // message while the page has focus, then the link opens the inbox (as
    // /share does) to paste it.
    const copyForInstagram = () => {
      if (copyWithTextarea(message)) toast.success("Copied: paste it in an Instagram chat");
      else void copyToClipboard(message).then((ok) => (ok ? toast.success("Copied: paste it in an Instagram chat") : toast.error("Couldn't copy: paste the link yourself")));
    };
    const shareToInstagram = (e: MouseEvent<HTMLAnchorElement>) => {
      const data = { text: message };
      const phone = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
      if (!phone || !canShareNatively(data)) {
        copyForInstagram();
        return;
      }
      e.preventDefault();
      navigator.share(data).catch((err: unknown) => {
        // Closing the sheet is a choice, not a failure.
        if (err instanceof DOMException && err.name === "AbortError") return;
        copyForInstagram();
        window.open(INSTAGRAM_DM_URL, "_blank", "noopener,noreferrer");
      });
    };
    return (
      <Screen title="Send Gift" paper>
        <div className="flex flex-col items-center pt-6 text-center" data-send-credit-packed>
          <GiftCardFace name={placeName} photo={row.card.photo} amount={amountText} />
          <h2 className="mt-8 text-2xl font-semibold tracking-tight">
            {link.reopened ? "Send it to one friend." : "Packed! Send it to one friend."}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
            The first to open it gets it. Until then you can take it back.
          </p>
          {/* ONE TAP PER CHANNEL (MESITA-4352, Pato: "add the shortcuts to
              share with WhatsApp or Instagram or just copy links … include
              sms too"): /share's marks as four round buttons, label under. */}
          <div className="mt-8 grid w-full grid-cols-4 gap-2" data-send-credit-channels>
            {(
              [
                { channel: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(message)}` },
                { channel: "instagram", label: "Instagram", href: INSTAGRAM_DM_URL, onClick: shareToInstagram },
                { channel: "messages", label: "Messages", href: `sms:?&body=${encodeURIComponent(message)}` },
                { channel: "copy", label: "Copy link", onClick: () => void copyLink(link.url) },
              ] as const
            ).map((c) => {
              const face = (
                <>
                  <span className={`flex h-14 w-14 items-center justify-center rounded-full [&_svg]:h-6 [&_svg]:w-6 ${CHANNEL_FACE[c.channel]}`}>
                    {CHANNEL_MARKS[c.channel]}
                  </span>
                  <span className="text-sm font-semibold">{c.label}</span>
                </>
              );
              const cls = "flex flex-col items-center gap-2 rounded-xl py-1 transition active:opacity-70";
              return "href" in c ? (
                <a
                  key={c.channel}
                  href={c.href}
                  target={c.channel === "messages" ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  onClick={"onClick" in c ? c.onClick : undefined}
                  className={cls}
                  aria-label={`Send by ${c.label}`}
                >
                  {face}
                </a>
              ) : (
                <button key={c.channel} type="button" onClick={c.onClick} className={cls}>
                  {face}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={`${SECONDARY} mt-6`}
            onClick={() => {
              // Back to the open gifts it came from; a new gift leaves as before.
              if (link.reopened) setLink(null);
              else done();
            }}
          >
            Done
          </button>
          {link.giftId ? (
            <button
              type="button"
              className="text-muted-foreground mt-2 py-3 text-sm font-semibold disabled:opacity-50"
              disabled={opening === link.giftId}
              onClick={() => void takeBack(link.giftId!)}
            >
              Take it back
            </button>
          ) : null}
        </div>
      </Screen>
    );
  }

  const placePanel = (
    <PaySection className="flex items-center gap-3 px-4 py-3" data-send-credit-place>
      <PlacePhotoMark photo={row.card.photo} name={placeName} />
      <span className="min-w-0">
        <span className="text-muted-foreground block text-sm">Send a gift at</span>
        <span className="block truncate text-base font-semibold">{placeName}</span>
        <span className="text-muted-foreground block text-sm tabular-nums">Up to {money(spendableCents, currency)}</span>
      </span>
    </PaySection>
  );

  // THE OPEN GIFTS, A STEP BEFORE THE KEYPAD (MESITA-4390): each gift packed
  // here that nobody took yet, newest first; a tap opens its card and share
  // buttons again; "New gift" goes on to the amount.
  const openHere = (wallet.sent_links ?? []).filter((l) => l.place_id === placeId);
  if (!fresh && openHere.length > 0) {
    return (
      <Screen
        title="Send Gift"
        paper
        footer={
          <div className="flex flex-col gap-2">
            <button type="button" className={PRIMARY} onClick={() => setFresh(true)} data-send-credit-new>
              New gift
            </button>
            <p className="text-muted-foreground text-center text-xs">Or send one that&apos;s waiting.</p>
          </div>
        }
      >
        <div className="flex flex-col gap-3" data-send-credit-open>
          {placePanel}
          {/* ONE BOX PER GIFT (MESITA-4396, Pato: "make boxes … those look
              like notifications"; picked A of three): a mini of the wine
              card, the amount and when it was packed, a pill button. The
              whole box is the tap. */}
          <h2 className="mt-1 px-1 text-lg font-semibold">Waiting for a friend</h2>
          <ul className="flex flex-col gap-3" data-send-credit-open-list>
            {openHere.map((l) => {
              const shareable = l.can_share !== false;
              return (
                <li key={l.gift_id}>
                  <button
                    type="button"
                    className="bg-card border-border flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60"
                    disabled={opening !== null}
                    onClick={() => void (shareable ? reopen(l.gift_id, l.amount_cents) : takeBack(l.gift_id))}
                  >
                    <GiftCardMini faded={!shareable} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold tabular-nums">{money(l.amount_cents, currency)}</span>
                      <span className="text-muted-foreground block text-sm">
                        Packed {entryDate(l.created_at)}
                        {shareable ? "" : " · link not saved"}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                        shareable ? "bg-foreground text-paper" : "border-border bg-card border"
                      }`}
                    >
                      {opening === l.gift_id ? "…" : shareable ? "Send" : "Take back"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
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
        {placePanel}
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
      <button type="button" className="text-muted-foreground mt-6 text-sm font-semibold" onClick={onClose}>
        Back to Wallet
      </button>
    </div>
  );
}

