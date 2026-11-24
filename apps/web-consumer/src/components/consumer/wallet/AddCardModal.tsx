"use client";

import { X } from "lucide-react";

import {
  AddCardFields,
  CARD_KEPT_LINE,
  CARD_SAVED_LINE,
  SaveCardButton,
  useAddCard,
} from "@/components/consumer/AddCardSheet";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { closeAddCardModal, useAddCardModalState } from "@/lib/added-card";
import { WALLET_CACHE_KEY } from "@/lib/api/wallet";
import { invalidateCached } from "@/lib/screen-cache";
import { toast } from "@/lib/toast";

// ADD A CARD, THE MODAL (MESITA-4398): the same form as the old page
// (useAddCard: one SetupIntent, Stripe's Payment Element, nothing charged)
// in a centred dialog over whatever screen opened it. Mounted once in the
// shell; lib/added-card.ts opens it. While saving it cannot be closed.
export function AddCardModal() {
  const opened = useAddCardModalState();
  const open = opened !== null;
  const form = useAddCard({
    active: open,
    onSaved: (id) => {
      toast.success("Card saved.");
      invalidateCached(WALLET_CACHE_KEY);
      opened?.onAdded(id);
      closeAddCardModal();
    },
  });
  const saving = form.phase.kind === "saving";
  const close = () => {
    if (saving) return;
    // The next open starts from the skeleton, not this one's dead form.
    form.reset();
    closeAddCardModal();
  };

  return (
    <LocalDialog open={open} onClose={close} ariaLabel="Add a card" fit>
      <div className="flex max-h-full min-h-0 flex-col" data-add-card-modal>
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <h2 className="text-xl font-semibold">Add a card</h2>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Close"
            className="border-border hover:bg-muted flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-4">
          <p className="text-muted-foreground mb-4 text-sm">{CARD_KEPT_LINE}</p>
          {open ? <AddCardFields form={form} /> : null}
        </div>
        <div className="border-border flex flex-col gap-2 border-t px-5 pt-4 pb-5">
          <SaveCardButton form={form} />
          <p className="text-muted-foreground text-center text-xs">{CARD_SAVED_LINE}</p>
        </div>
      </div>
    </LocalDialog>
  );
}
