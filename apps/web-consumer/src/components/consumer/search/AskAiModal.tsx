"use client";

import { X } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { AskAiSoon } from "./AskAiSoon";

// ASK AI IS A POPUP (Pato, 2026-11-20, MESITA-4480: "make ask AI a pop up
// modal, not its own page"). The floating card, the same shape as
// Categories (MESITA-4433): inset from the card, a title and an X, then
// the Soon body. There is no Ask AI page; /search/chat 308s to Search.
export function AskAiModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalDialog open={open} onClose={onClose} ariaLabel="Ask AI" fit>
      <header className="border-border flex h-14 shrink-0 items-center border-b pr-1.5 pl-5">
        <h2 className="text-foreground flex-1 text-base font-semibold">
          Ask AI
        </h2>
        <button
          type="button"
          aria-label="Close Ask AI"
          onClick={onClose}
          className="text-foreground hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full transition"
        >
          <X className="h-6 w-6" strokeWidth={2.25} />
        </button>
      </header>
      <div className="flex min-h-64 flex-col">
        <AskAiSoon />
      </div>
    </LocalDialog>
  );
}
