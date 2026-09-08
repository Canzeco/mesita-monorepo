"use client";

// The saved payment methods, as a LIST rather than a sheet (MESITA-1672).
//
// ONE LIST, TWO MOUNTS. `CardsModal` was written with a header comment titled
// "TWO DOORWAYS, ONE SHEET" to guarantee the live Stripe flow has exactly one
// definition, and Pay › Wallet imported that whole sheet rather than
// reimplementing it. The Wallet is about to render cards INLINE, with its own
// section title and its own Add button in the header (Pato, 2026-09-08), and
// the sheet cannot give it that. So the sheet is not what gets shared any
// more: the state and the rows are.
//
// WHY A HOOK AND A COMPONENT, NOT ONE COMPONENT WITH FLAGS. The Wallet needs
// the Add button top-right of a section header and the sheet needs it under
// the list. A `hideAddButton` prop would put layout decisions inside the thing
// that owns the Stripe calls, and the next surface would add a second flag.
// Splitting state from presentation lets each mount lay itself out while there
// is still exactly one definition of what adding, removing and defaulting a
// card DO.
//
// Nothing here is cached. Stripe is the only store for card data, so the list
// is fetched on first activation (ref latch — a render-free trigger, never
// setState in an effect) and refetched after every mutation. `is_default`
// arrives derived from the customer's invoice settings.
//
// Adding a card leaves the app: the number is typed on Stripe's hosted page,
// which is what keeps this codebase out of PCI scope. The return trip lands on
// /me?cards=added and re-opens the sheet from a server prop.

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, Plus, Trash2 } from "lucide-react";

import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import {
  ERROR_BOX_CLASS,
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

export type ConsumerCardsState = ReturnType<typeof useConsumerCards>;

/** `active` is "this list is on screen" — `open` for a sheet, `true` for an
 *  inline mount. The fetch happens once, the first time it turns true. */
export function useConsumerCards(active: boolean) {
  const supabase = useBrowserSupabase();
  const [cards, setCards] = useState<ConsumerCard[]>([]);
  const [mock, setMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The row currently being mutated — only it disables, so the list never
  // blanks out under the guest mid-tap.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ConsumerCard | null>(null);
  const requestedRef = useRef(false);

  const reload = useCallback(async () => {
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
    if (!active || requestedRef.current) return;
    requestedRef.current = true;
    void reload();
  }, [active, reload]);

  const add = useCallback(async () => {
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
  }, [supabase]);

  const setDefault = useCallback(
    async (card: ConsumerCard) => {
      if (card.is_default) return;
      setBusyId(card.id);
      try {
        await apiSetDefaultCard(supabase, card.id);
        await reload();
      } catch (e) {
        toast(errMsg(e, "Couldn't make that your default card."));
      } finally {
        setBusyId(null);
      }
    },
    [supabase, reload],
  );

  const remove = useCallback(
    async (card: ConsumerCard) => {
      setBusyId(card.id);
      try {
        await apiRemoveCard(supabase, card.id);
        setConfirmRemove(null);
        await reload();
      } catch (e) {
        // card_backs_subscription lands here with its own sentence — the EF
        // already says "Add another card first", so no rewrite.
        toast(errMsg(e, "Couldn't remove that card."));
      } finally {
        setBusyId(null);
      }
    },
    [supabase, reload],
  );

  return {
    cards,
    mock,
    loading,
    loadError,
    busyId,
    addBusy,
    confirmRemove,
    setConfirmRemove,
    reload,
    add,
    setDefault,
    remove,
  };
}

/** The rows, their loading and empty states, and the remove confirm. Layout
 *  above and below them belongs to the mount. */
export function CardList({ state }: { state: ConsumerCardsState }) {
  const { cards, loading, loadError, busyId } = state;

  return (
    <>
      <div className="flex flex-col gap-2.5">
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
              onClick={() => void state.reload()}
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
              onSetDefault={() => void state.setDefault(card)}
              onAskRemove={() => state.setConfirmRemove(card)}
            />
          ))
        )}
      </div>

      {/* Safe to render here even inside a LocalSheet: LocalDialog portals to
          the card root (LocalOverlay's CardPortal), so it never lands inside
          the sheet's own panel. */}
      <RemoveCardDialog
        card={state.confirmRemove}
        busy={!!state.confirmRemove && busyId === state.confirmRemove.id}
        onClose={() => state.setConfirmRemove(null)}
        onConfirm={() =>
          state.confirmRemove && void state.remove(state.confirmRemove)}
      />
    </>
  );
}

export function AddCardButton({
  state,
  className,
  /** "Add a card" under a sheet's list; "Add" in a section header where the
   *  heading beside it already says what is being added. */
  label = "Add a card",
}: {
  state: ConsumerCardsState;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void state.add()}
      disabled={state.addBusy}
      // The visible label can shorten to "Add"; the accessible name must not,
      // because a screen reader reaching this button out of context gets no
      // heading with it.
      aria-label={label === "Add a card" ? undefined : "Add a card"}
      className={className}
    >
      {state.addBusy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Plus className="size-4" aria-hidden />
      )}
      {label}
    </button>
  );
}

/** Stripe holds the card, and the guest should be told so wherever the list
 *  appears — including the mock note, or the Wallet shows fake cards as real. */
export function CardsDisclosure({
  mock,
  className,
}: {
  mock: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-muted-foreground/80 type-label text-center leading-relaxed",
        className,
      )}
    >
      Your card details are held by Stripe. Mesita never sees your card number.
      {mock ? " Test mode — no card is stored yet." : ""}
    </p>
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
