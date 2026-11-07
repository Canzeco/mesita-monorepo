// Visits and Transactions (MESITA-3301, Pato: "In Operations include Views
// and Visits and Transactions. Keep the pages even if Mesita Payments is not
// enabled yet"). Both wear the Views frame (MESITA-3213: the last 30 days on
// the left, the log on the right) with nothing in it: no place takes payments
// in Mesita yet, so there is no visit and no transaction to show, and the page
// says so instead of hiding. No mock rows (Pato rejects mock data on product
// surfaces). The counts and the log arrive with the pay flow (MESITA-3272 W2)
// and the owner's money section (W3); this frame is what they fill.

import Link from "next/link";
import { Card } from "@/components/shell/Page";
import { ViewsChart } from "@/app/(console)/places/[id]/views/ViewsChart";
import { getPlacePayments } from "@/lib/business-api";
import { placeTabHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ROW = "flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6";

export type OperationsRow = { name: string; line: string };

export async function OperationsPage({
  placeId,
  chartLine,
  rows,
  logLine,
  empty,
}: {
  placeId: string;
  /** Under "Last 30 days": what the series counts. */
  chartLine: string;
  /** The totals under the chart, each at zero until the data exists. */
  rows: OperationsRow[];
  /** Under "Log": what the rows will be. */
  logLine: string;
  /** The one row the log shows while there is nothing. */
  empty: string;
}) {
  // Whether the place can take payments at all: the Stripe account on
  // Payments. A place that cannot is told where to start; one that can waits
  // for its first guest. A failed read says neither.
  const payments = await getPlacePayments(placeId);
  const canCharge = payments.ok ? payments.data.account.charges_enabled : null;
  return (
    <div className="grid grid-cols-1 items-start gap-4 pb-8 lg:grid-cols-2 lg:gap-5">
      <Card className="flex min-w-0 flex-col p-0 sm:p-0">
        <ViewsChart days={[]} line={chartLine} />
        <ul className="divide-border border-border divide-y border-t">
          {rows.map((row) => (
            <li key={row.name} className={ROW}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{row.name}</p>
                <p className="text-muted-foreground">{row.line}</p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">0</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex min-w-0 flex-col p-0 sm:p-0">
        <div className="px-5 py-4 sm:px-6">
          <h2 className="font-sans text-sm font-medium tracking-normal">Log</h2>
          <p className="text-muted-foreground text-sm">{logLine}</p>
        </div>
        <ul className="divide-border border-border divide-y border-t">
          <li className={cn(ROW, "text-muted-foreground")}>{empty}</li>
          {canCharge === false ? (
            <li className={cn(ROW, "text-muted-foreground")}>
              <p>
                Guests can pay here once your Stripe account is connected on{" "}
                <Link href={placeTabHref(placeId, "payments")} className="text-foreground font-semibold underline underline-offset-4">
                  Payments
                </Link>
                .
              </p>
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
