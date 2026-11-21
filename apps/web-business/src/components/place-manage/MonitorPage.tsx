// One Monitor page (MESITA-4538): the place's list of one kind, read on the
// server with the URL's filters (?id= one row, ?customer= one guest), in one
// card. The server is the door: an editor gets the owner-only card.
import { listMonitor } from "@/lib/business-api";
import { customerParam, uuidParam, type MonitorKind } from "@/lib/monitor";
import { getPlacePayments } from "@/lib/business-api";
import { CardHeader, MonitorCard, MonitorError, MonitorList } from "./MonitorList";
import { OpenStripeButton } from "./OpenStripeButton";
import { ExportButton, MonitorToolbar } from "./ExportButton";
import { Payouts } from "./Payouts";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function MonitorPage({
  placeId,
  kind,
  page,
  searchParams,
  payouts = false,
}: {
  placeId: string;
  kind: MonitorKind;
  /** The URL segment, for Show all. */
  page: string;
  searchParams: SearchParams;
  /** Payments: payouts to the bank in the same card (MESITA-4538). */
  payouts?: boolean;
}) {
  const sp = await searchParams;
  const filter = { id: uuidParam(sp.id), customer: customerParam(sp.customer) };
  const [r, payments] = await Promise.all([listMonitor(placeId, kind, filter), payouts ? getPlacePayments(placeId) : Promise.resolve(null)]);
  // Open Stripe only with a connected account (the dashboard needs one).
  const stripe = payments?.ok && payments.data.account.state !== "none";
  if (!r.ok) return <MonitorError code={r.code} error={r.error} />;
  return (
    <div className="flex flex-col gap-4 pb-8">
      <MonitorToolbar>
        {stripe ? <OpenStripeButton placeId={placeId} /> : null}
        <ExportButton placeId={placeId} kind={kind} filter={filter} name={page === "money" ? "stripe" : page} />
      </MonitorToolbar>
      <MonitorCard>
        {payouts ? <CardHeader title="Card payments" /> : null}
        <MonitorList
          key={`${filter.id ?? ""}|${filter.customer ?? ""}`}
          placeId={placeId}
          kind={kind}
          initial={r.data}
          filter={filter}
          clearHref={`/places/${encodeURIComponent(placeId)}/${page}`}
        />
        {payouts && !filter.id && !filter.customer ? <Payouts placeId={placeId} timezone={r.data.timezone} /> : null}
        {payouts && (filter.id || filter.customer) ? (
          <p className="text-muted-foreground border-border border-t px-5 py-3 text-sm sm:px-6">Payouts are hidden while a filter is on.</p>
        ) : null}
      </MonitorCard>
    </div>
  );
}
