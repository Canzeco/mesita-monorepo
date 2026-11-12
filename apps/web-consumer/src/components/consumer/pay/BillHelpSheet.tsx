"use client";

import { Button } from "@/components/ui/button";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";

// FIND THE TOTAL (MESITA-3796): the Bill step's "Where is it?". A small
// restaurant ticket drawn in CSS (never an image): the place's name bar,
// three item lines each with a price bar, a dashed rule, then the "Total"
// line with its amount outlined in ink, the one thing to read. One
// sentence, Done. Ink only: colour is for marks, never for help.

export const BILL_HELP_SENTENCE = "It's the total at the bottom of your ticket, before any tip. If you can't find it, ask the waiter.";

/** The sheet's content, on its own so a scratch render can draw it. */
export function BillHelpCard({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4" data-bill-help>
      <p className="pt-2 pb-4 text-lg font-semibold">Find the total</p>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <TicketDrawing />
      </div>
      <p className="text-muted-foreground mt-4 text-base">{BILL_HELP_SENTENCE}</p>
      <Button type="button" size="lg" className="mt-4 min-h-12 w-full shrink-0 text-base font-semibold" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

function Bar({ w }: { w: string }) {
  return <span className={`bg-border block h-1.5 rounded-full ${w}`} />;
}

function Line({ item, price }: { item: string; price: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Bar w={item} />
      <Bar w={price} />
    </div>
  );
}

/** A restaurant ticket, drawn: the Total's amount outlined in ink. */
function TicketDrawing() {
  return (
    <div className="border-border bg-card flex w-56 flex-col gap-2.5 rounded-lg border px-4 py-4 shadow-sm" aria-hidden>
      <span className="bg-border mb-1 block h-2.5 w-1/2 self-center rounded-full" />
      <Line item="w-24" price="w-8" />
      <Line item="w-20" price="w-8" />
      <Line item="w-28" price="w-8" />
      <div className="border-border my-1 border-t border-dashed" />
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold">Total</span>
        <span className="border-foreground -mr-1.5 flex h-7 items-center rounded-md border-2 px-1.5">
          <Bar w="w-12" />
        </span>
      </div>
    </div>
  );
}

export function BillHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Find the total">
      <BillHelpCard onDone={onClose} />
    </LocalSheet>
  );
}
