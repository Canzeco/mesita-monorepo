"use client";

import { useState } from "react";
import { MessageCircle, Phone, Sparkles } from "lucide-react";

import { ComingSoonModal } from "@/components/consumer/ComingSoonModal";
import { cn } from "@/lib/utils";

// The Memo mode's own header (MESITA-1102) — Don Memo, and the two ways to
// reach him.
//
// WHY THE MODE HAS A HEADER AT ALL. Memo used to be one thing, so the Home
// pill said "Chat" and the page below it was the thread, top to bottom. It is
// two things now — you can CALL him or you can TYPE at him — and a mode with
// two ways in needs to say so before you start, not after. Call leads because
// it is the one a guest wouldn't guess.
//
// CALL IS ANNOUNCED, NOT WIRED (Pato, live: "announced only, for now"). There
// is no Memo voice agent and no number behind it — the ElevenLabs workspace
// holds none — so the segment opens a coming-soon panel instead of dialling.
// It stays visible because the two-way shape IS the product statement, exactly
// how Order sits in the place-detail bar with nothing behind it.
//
// So Chat is the only segment that ever wins the selected state, and Call is
// styled the way HomeModeNav styles a parked pill: muted, tappable, explained
// on tap (MESITA-601 — no "soon" badges anywhere in this app).
export function MemoModeHeader() {
  const [callSoon, setCallSoon] = useState(false);

  const seg =
    "flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition active:scale-[0.98] motion-reduce:active:scale-100";

  return (
    <>
      <div className="border-border bg-background/90 shrink-0 border-b px-3 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-full">
            <Sparkles className="size-[18px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-tight font-semibold">Don Memo</p>
            <p className="text-muted-foreground text-[11px] leading-tight">
              Your Mesita concierge
            </p>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setCallSoon(true)}
            aria-haspopup="dialog"
            className={cn(
              seg,
              "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted border",
            )}
          >
            <Phone className="size-3.5" strokeWidth={2.2} />
            Call
          </button>

          {/* Not a button: Chat is where you already are, and a control that
              can only re-select the current state is a dead tap. It renders as
              the selected segment so the pair reads as a switch. */}
          <span
            aria-current="page"
            className={cn(
              seg,
              "bg-primary text-primary-foreground shadow-glow",
            )}
          >
            <MessageCircle className="size-3.5" strokeWidth={2.2} />
            Chat
          </span>
        </div>
      </div>

      <ComingSoonModal
        open={callSoon}
        onClose={() => setCallSoon(false)}
        title="Calling Don Memo"
        body="Soon you'll be able to call Don Memo and just say what you're in the mood for — he'll talk you to a table. Until then he's right here, in chat."
        icon={Phone}
      />
    </>
  );
}
