"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/cn";

/** Which Off tile of the pinned row was tapped (MESITA-3583; Reserve ·
 *  Offers since MESITA-4151). */
export type OffTile = "reserve" | "offers";

/** What an Off tile says (Pato, MESITA-3583: "for reservations: this place
 *  doesn't offer reservations ..."). */
export const OFF_TILE_TEXT: Record<OffTile, { title: string; text: string }> = {
  reserve: { title: "Reserve", text: "This place doesn't offer reservations." },
  offers: { title: "Offers", text: "This place has no offers right now." },
};

/** THE OFF SHEET (MESITA-3583): an Off tile still answers a tap, with one
 *  line saying why and one close. Portals into the consumer app's card like
 *  the Offers (i) note (MESITA-3524), else the body (admin's preview). */
export function OffTileSheet({
  tile,
  line,
  onClose,
}: {
  tile: OffTile;
  /** Says this instead of the tile's standard line (MESITA-3604). */
  line?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  const host = document.getElementById("mesita-app-card");
  const { title } = OFF_TILE_TEXT[tile];
  const text = line ?? OFF_TILE_TEXT[tile].text;
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
        <span className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="bg-foreground text-paper h-11 flex-1 rounded-xl text-sm font-semibold hover:opacity-90"
          >
            Close
          </button>
        </span>
      </span>
    </span>,
    host ?? document.body,
  );
}
