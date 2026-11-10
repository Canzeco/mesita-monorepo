"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/format";

/** Which grey tile of the pinned row was tapped (MESITA-3583). */
export type OffTile = "reserve" | "prepay" | "wallet" | "pay";

/** What an Off tile says (Pato, MESITA-3583: "for reservations: this place
 *  doesn't offer reservations, or this place doesn't currently offer Mesita
 *  Pay, or you currently have no credits, add card"). */
export const OFF_TILE_TEXT: Record<OffTile, { title: string; text: string }> = {
  reserve: { title: "Reserve", text: "This place doesn't offer reservations." },
  prepay: { title: "Prepay", text: "This place doesn't accept prepayments." },
  wallet: { title: "Wallet", text: "You have no credits at this place yet." },
  pay: { title: "Pay", text: "This place doesn't currently offer Mesita Payments." },
};

type AddState = "idle" | "adding" | "added" | "failed";

/** THE OFF SHEET (MESITA-3583): a grey "Off" tile still answers a tap, with
 *  one line saying why and one close. Wallet adds "Add card to Wallet": the
 *  place's House Card goes in the guest's Wallet with $0, or, already there,
 *  "Open Wallet". Portals into the consumer app's card like the Offers (i)
 *  note (MESITA-3524), else the body (admin's preview). */
export function OffTileSheet({
  tile,
  line,
  onClose,
  inWallet,
  onAddHouseCard,
  onOpenWallet,
}: {
  tile: OffTile;
  /** Says this instead of the tile's standard line (MESITA-3604). */
  line?: string;
  onClose: () => void;
  inWallet?: boolean;
  onAddHouseCard?: () => Promise<boolean>;
  onOpenWallet?: () => void;
}) {
  const [add, setAdd] = useState<AddState>("idle");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  const host = document.getElementById("mesita-app-card");
  const { title } = OFF_TILE_TEXT[tile];
  const text = line ?? OFF_TILE_TEXT[tile].text;
  const inIt = inWallet === true || add === "added";
  const wallet = tile === "wallet";
  const note =
    !wallet ? null
    : add === "added" ? "This place's House Card is now in your Wallet."
    : inIt ? "This place's House Card is already in your Wallet."
    : add === "failed" ? "Couldn't add the card. Try again."
    : null;
  const primary =
    !wallet ? null
    : inIt ? (onOpenWallet ? { label: "Open Wallet", run: () => { onClose(); onOpenWallet(); } } : null)
    : onAddHouseCard
      ? {
        label: add === "adding" ? "Adding…" : "Add card to Wallet",
        run: () => {
          if (add === "adding") return;
          setAdd("adding");
          onAddHouseCard().then((ok) => setAdd(ok ? "added" : "failed"), () => setAdd("failed"));
        },
      }
      : null;
  return createPortal(
    <span
      className={cn(host ? "absolute" : "fixed", "inset-0 z-[135] flex items-center justify-center bg-black/40 p-6")}
      onClick={onClose}
      data-off-sheet={tile}
    >
      <span
        role="dialog"
        aria-modal="true"
        aria-label={`${title}: ${text}`}
        className="bg-card flex w-full max-w-sm cursor-auto flex-col gap-3 rounded-2xl p-5 text-left shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-foreground text-lg font-semibold">{title}</span>
        <span className="text-muted-foreground text-base leading-snug">{text}</span>
        {note ? <span className="text-foreground text-sm font-medium" role="status">{note}</span> : null}
        <span className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            autoFocus={!primary}
            className={cn(
              "h-11 rounded-xl text-sm font-semibold hover:opacity-90",
              primary ? "bg-muted text-foreground w-28 shrink-0" : "bg-foreground text-paper flex-1",
            )}
          >
            Close
          </button>
          {primary ? (
            <button
              type="button"
              onClick={primary.run}
              autoFocus
              aria-busy={add === "adding"}
              className="bg-foreground text-paper h-11 flex-1 rounded-xl text-sm font-semibold hover:opacity-90"
            >
              {primary.label}
            </button>
          ) : null}
        </span>
      </span>
    </span>,
    host ?? document.body,
  );
}
