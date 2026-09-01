"use client";

import { Sparkles } from "lucide-react";

// The Memo mode's header (MESITA-1103) — who you are talking to, and nothing
// else.
//
// IT USED TO CARRY A CALL/CHAT SEGMENT PAIR. That pair announced the mode's
// two ways in before you started, which was the right instinct and the wrong
// place: it read as a mode SWITCH (Chat permanently selected, Call never
// selectable), and it spent ~60px of pinned chrome on a decision the guest had
// already made by arriving here.
//
// Call moved into the COMPOSER on 2026-09-01, beside Send — the slot every
// messaging app gives its voice affordance. Voice and text are the same act,
// so they belong in the same row. See AskAiPanel's `onCall`.
//
// What is left is identity: the concierge has a name and a face, and a thread
// with neither reads like a form. Don Memo is the persona; Chat is the mode.
export function MemoModeHeader() {
  return (
    <div className="border-border bg-background/90 shrink-0 border-b px-3 py-2.5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-full">
          <Sparkles className="size-[18px]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-semibold">Don Memo</p>
          <p className="text-muted-foreground type-label leading-tight">
            Your Mesita concierge
          </p>
        </div>
      </div>
    </div>
  );
}
