"use client";

// The saved payment methods for Mesita Pay — the card rail Stripe Connect
// prepares on the place side (#1415).
//
// TWO DOORWAYS, ONE SHEET (Pato, 2026-08-31). Opened from Me › More › Cards
// and from Activity › Wallet › Payment methods, which imports this component
// rather than reimplementing it — the live Stripe flow has exactly one
// definition. The old "two wallets, two words · never call this one a wallet"
// rule is retired: cards are now a row INSIDE the one Wallet, so the word is
// no longer contested and Credits keeps naming the money.
//
// This is the one LIVE thing on the Wallet screen. The parked framing there
// (the hero Soon pill, the demo clock) covers the Credits emulator and must
// never be read as covering these cards.
//
// Nothing here is cached. Stripe is the only store for card data, so the list
// is fetched on first open (ref latch, same shape as MetricsModal — a render
// -free trigger, never setState in an effect) and refetched after every
// mutation. `is_default` arrives derived from the customer's invoice settings.
//
// Adding a card leaves the app: the number is typed on Stripe's hosted page,
// which is what keeps this codebase out of PCI scope. The return trip lands on
// /me?cards=added and re-opens this sheet from a server prop.

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, Plus, Trash2 } from "lucide-react";

import {
  LocalDialog,
  LocalSheet,
} from "@/components/consumer/overlay/LocalOverlay";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import {
  ERROR_BOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_BODY_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import {
  apiAddCard,
  apiListCards,
  apiRemoveCard,
  apiSetDefaultCard,
  formatCardExpiry,
  formatCardLabel,
  isCardExpired,
  type ConsumerCard,
} from "@/lib/api/cards";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { cn, errMsg } from "@/lib/utils";

export function CardsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [cards, setCards] = useState<ConsumerCard[]>([]);
  const [mock, setMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The row currently being mutated — only it disables, so the sheet never
  // blanks out under the guest mid-tap.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ConsumerCard | null>(null);
  const requestedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiListCards(supabase);
      setCards(res.cards);
      setMock(res.mock);
    } catch (e) {
      setLoadError(errMsg(e, "Couldn't load your cards."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!open || requestedRef.current) return;
    requestedRef.current = true;
    void load();
  }, [open, load]);

  async function handleAdd() {
    setAddBusy(true);
    try {
      const { setupUrl } = await apiAddCard(supabase);
      // Full navigation, not a new tab: Stripe's hosted page owns the next
      // screen and sends the guest back to /me?cards=added.
      window.location.href = setupUrl;
    } catch (e) {
      toast(errMsg(e, "Couldn't start adding a card."));
      setAddBusy(false);
    }
  }

  async function handleSetDefault(card: ConsumerCard) {
    if (card.is_default) return;
    setBusyId(card.id);
    try {
      await apiSetDefaultCard(supabase, card.id);
      await load();
    } catch (e) {
      toast(errMsg(e, "Couldn't make that your default card."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(card: ConsumerCard) {
    setBusyId(card.id);
    try {
      await apiRemoveCard(supabase, card.id);
      setConfirmRemove(null);
      await load();
    } catch (e) {
      // card_backs_subscription lands here with its own sentence — the EF
      // already says "Add another card first", so no rewrite.
      toast(errMsg(e, "Couldn't remove that card."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <LocalSheet open={open} onClose={onClose} ariaLabel="Cards">
        <div className={SHEET_BODY_CLASS}>
          <div className="flex items-center gap-2.5">
            <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-xl">
              <CreditCard
                className="size-[18px]"
                strokeWidth={2.25}
                aria-hidden
              />
            </span>
            <div>
              <h2 className={SHEET_TITLE_CLASS}>Cards</h2>
              <p className="text-muted-foreground text-xs">
                Saved cards for Premium and Mesita Pay
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {loading ? (
              <>
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </>
            ) : loadError ? (
              <div className="flex flex-col gap-2">
                <p className={ERROR_BOX_CLASS}>{loadError}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="border-border bg-card hover:bg-muted self-start rounded-xl border px-3 py-2 text-xs font-semibold transition"
                >
                  Try again
                </button>
              </div>
            ) : cards.length === 0 ? (
              <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-4 py-6 text-center text-xs">
                No cards yet. Add one to pay faster.
              </p>
            ) : (
              cards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  busy={busyId === card.id}
                  onSetDefault={() => void handleSetDefault(card)}
                  onAskRemove={() => setConfirmRemove(card)}
                />
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={addBusy}
            className={cn(PRIMARY_BUTTON_CLASS, "mt-4")}
          >
            {addBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Add a card
          </button>

          <p className="text-muted-foreground/80 type-label mt-3 text-center leading-relaxed">
            Your card details are held by Stripe. Mesita never sees your card
            number.
            {mock ? " Test mode — no card is stored yet." : ""}
          </p>
        </div>
      </LocalSheet>

      {/* A SIBLING of the sheet, never a child — nesting it inside would
          render the confirm inside the sheet's own panel. Same shape as
          DeleteAccountSheet next to SettingsModal in ProfileClient. */}
      <RemoveCardDialog
        card={confirmRemove}
        busy={!!confirmRemove && busyId === confirmRemove.id}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => confirmRemove && void handleRemove(confirmRemove)}
      />
    </>
  );
}

function CardRow({
  card,
  busy,
  onSetDefault,
  onAskRemove,
}: {
  card: ConsumerCard;
  busy: boolean;
  onSetDefault: () => void;
  onAskRemove: () => void;
}) {
  const expired = isCardExpired(card);
  const expiry = formatCardExpiry(card);

  return (
    <div
      aria-busy={busy || undefined}
      className={cn(
        "border-border bg-card flex min-h-14 flex-col gap-2 rounded-2xl border px-3.5 py-3 transition",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl",
            expired ? "bg-muted/60" : "bg-primary/12",
          )}
        >
          <CreditCard
            className={cn(
              "size-4",
              expired ? "text-muted-foreground" : "text-primary",
            )}
            aria-hidden
          />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs leading-tight font-bold",
              expired ? "text-muted-foreground" : "text-foreground",
            )}
          >
            <span className="truncate">{formatCardLabel(card)}</span>
            {expired ? (
              <span className="bg-muted text-muted-foreground type-meta shrink-0 rounded-full px-1.5 py-0.5 font-bold tracking-wide uppercase">
                Expired
              </span>
            ) : null}
          </span>
          {expiry ? (
            <span className="text-muted-foreground type-label mt-0.5 block">
              Expires {expiry}
            </span>
          ) : null}
        </span>

        {/* A real button, not a styled span: making a card the default is an
            action, and aria-pressed is how it reads as one. */}
        <button
          type="button"
          aria-pressed={card.is_default}
          disabled={busy || card.is_default || expired}
          onClick={onSetDefault}
          className={cn(
            "type-meta shrink-0 rounded-full px-2 py-1 font-bold tracking-wide uppercase transition",
            card.is_default
              ? "bg-primary/12 text-primary"
              : "bg-muted text-muted-foreground hover:bg-muted/70 disabled:opacity-45",
          )}
        >
          {card.is_default ? "Default" : "Make default"}
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAskRemove}
          disabled={busy}
          className="text-muted-foreground hover:text-destructive type-label font-semibold transition disabled:opacity-45"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// Detaching is irreversible from the guest's side, so it is a LocalDialog —
// the package rule (a confirm is a dialog, not a short sheet) and the shape
// DeleteAccountSheet already uses over the Settings sheet. Two LocalSheets
// must never stack; a dialog over a sheet is the sanctioned pair.
function RemoveCardDialog({
  card,
  busy,
  onClose,
  onConfirm,
}: {
  card: ConsumerCard | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <LocalDialog open={!!card} onClose={onClose} ariaLabel="Remove card">
      <div className={cn(SHEET_BODY_CLASS, "overflow-y-auto")}>
        <div className="flex items-start gap-3">
          <span className="bg-destructive/10 text-destructive flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <Trash2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Remove card</h2>
            <p className="text-muted-foreground text-xs">
              {card ? formatCardLabel(card) : ""}
            </p>
          </div>
        </div>

        <p className="text-muted-foreground type-body mt-4 leading-snug">
          The card is removed from Stripe as well. You can add it again any
          time.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={SHEET_CANCEL_BUTTON_CLASS}
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="bg-destructive flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            {busy ? (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}
