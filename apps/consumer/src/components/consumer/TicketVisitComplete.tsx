"use client";

import { CheckCircle2 } from "lucide-react";

export function TicketVisitComplete({
  ticketKind: _ticketKind,
}: {
  ticketKind?: string | null;
}) {
  return (
    <section className="surface-card-soft space-y-4 p-4">
      <div className="flex flex-col items-center py-2 text-center">
        <CheckCircle2 className="text-secondary h-12 w-12" strokeWidth={1.75} />
        <h2 className="text-foreground mt-3 text-xl font-bold">
          Visit complete
        </h2>
        <p className="text-muted-foreground mt-1 max-w-xs text-sm leading-relaxed">
          Thanks for using Mesita at this restaurant. Your discount was applied
          to the bill.
        </p>
      </div>
    </section>
  );
}
