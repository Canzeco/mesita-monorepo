// One Monitor page (MESITA-4538): the place's list of one kind, read on the
// server with the URL's filters (?id= one row, ?customer= one guest), in one
// card. The server is the door: an editor gets the owner-only card.
import { listMonitor } from "@/lib/business-api";
import { customerParam, uuidParam, type MonitorKind } from "@/lib/monitor";
import { getPlacePayments } from "@/lib/business-api";
import { MonitorCard, MonitorError, MonitorList } from "./MonitorList";
import { OpenStripeButton } from "./OpenStripeButton";
import { ExportButton, MonitorToolbar } from "./ExportButton";
import { Payouts } from "./Payouts";
import { MonitorAnalytics } from "./MonitorAnalytics";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function MonitorPage({
  placeId,
  kind,
  page,
  searchParams,
}: {
  placeId: string;
  kind: MonitorKind;
  /** The URL segment, for Show all. */
  page: string;
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filter = { id: uuidParam(sp.id), customer: customerParam(sp.customer) };
  const r = await listMonitor(placeId, kind, filter);
  if (!r.ok) return <MonitorError code={r.code} error={r.error} />;
  // Analytics on top (MESITA-4677): the server sends them on the first,
  // unfiltered page of Visits and Vouchers only.
  const analytics =
    r.data.analytics && (kind === "visits" || kind === "vouchers")
      ? ({ kind, ...r.data.analytics } as Parameters<typeof MonitorAnalytics>[0]["analytics"])
      : null;
  return (
    <div className="flex flex-col gap-4 pb-8">
      <MonitorToolbar>
        <ExportButton placeId={placeId} kind={kind} filter={filter} name={page === "money" ? "payments" : page} />
      </MonitorToolbar>
      {analytics ? <MonitorAnalytics analytics={analytics} /> : null}
      <MonitorCard>
        <MonitorList
          key={`${filter.id ?? ""}|${filter.customer ?? ""}`}
          placeId={placeId}
          kind={kind}
          initial={r.data}
          filter={filter}
          clearHref={`/places/${encodeURIComponent(placeId)}/${page}`}
        />
      </MonitorCard>
    </div>
  );
}

/** Payouts to the bank, its own page (MESITA-4679; the right column of
 *  Payments since MESITA-4564). The payments read is the door (an editor gets
 *  the owner-only card) and gives the place's timezone. */
export async function PayoutsPage({ placeId }: { placeId: string }) {
  const [r, payments] = await Promise.all([listMonitor(placeId, "payments"), getPlacePayments(placeId)]);
  if (!r.ok) return <MonitorError code={r.code} error={r.error} />;
  // Open Stripe only with a connected account (the dashboard needs one).
  const stripe = payments.ok && payments.data.account.state !== "none";
  return (
    <div className="flex flex-col gap-4 pb-8">
      {stripe ? (
        <MonitorToolbar>
          <OpenStripeButton placeId={placeId} />
        </MonitorToolbar>
      ) : null}
      <MonitorCard>
        <Payouts placeId={placeId} timezone={r.data.timezone} />
      </MonitorCard>
    </div>
  );
}
