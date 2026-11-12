"use client";

import { Button } from "@/components/ui/button";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";

// FIND YOUR TICKET NUMBER (MESITA-3776): the Ticket step's "Where is it?".
// A small ticket drawn in CSS (never an image): grey bars for its lines, an
// unhighlighted "Mesa 5" (the table, which is NOT the ticket number) and
// "Folio ▮▮▮▮" at the top left inside an ink outline. One sentence, Done.
// Ink only: colour is for marks, never for help.

export const TICKET_HELP_SENTENCE =
  "It's printed at the top of your ticket, often as Folio or No. It is not the table number. If you can't find it, ask the waiter.";

/** The sheet's content, on its own so a scratch render can draw it. */
export function TicketHelpCard({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4" data-ticket-help>
      <p className="pt-2 pb-4 text-lg font-semibold">Find your ticket number</p>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <TicketDrawing />
      </div>
      <p className="text-muted-foreground mt-4 text-base">{TICKET_HELP_SENTENCE}</p>
      <Button type="button" size="lg" className="mt-4 min-h-12 w-full shrink-0 text-base font-semibold" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

function Bar({ w }: { w: string }) {
  return <span className={`bg-border block h-1.5 rounded-full ${w}`} />;
}

/** A restaurant ticket, drawn: the Folio outlined in ink at the top left. */
function TicketDrawing() {
  return (
    <div className="border-border bg-card flex w-52 flex-col gap-2 rounded-lg border px-4 py-4 shadow-sm" aria-hidden>
      <span className="border-foreground -ml-1.5 self-start rounded-md border-2 px-1.5 py-0.5 text-sm font-semibold tabular-nums">
        Folio ▮▮▮▮
      </span>
      <Bar w="w-3/4" />
      <Bar w="w-1/2" />
      <span className="text-muted-foreground text-sm">Mesa 5</span>
      <div className="border-border my-1 border-t border-dashed" />
      <div className="flex items-center justify-between gap-4">
        <Bar w="w-24" />
        <Bar w="w-8" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Bar w="w-20" />
        <Bar w="w-8" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Bar w="w-28" />
        <Bar w="w-8" />
      </div>
      <div className="border-border my-1 border-t border-dashed" />
      <div className="flex items-center justify-between gap-4">
        <Bar w="w-12" />
        <Bar w="w-10" />
      </div>
    </div>
  );
}

export function TicketHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Find your ticket number">
      <TicketHelpCard onDone={onClose} />
    </LocalSheet>
  );
}
