import { getPlaceViews, listPlaceViewsLog } from "@/lib/business-api";
import { customerParam } from "@/lib/monitor";
import { MonitorError } from "@/components/place-manage/MonitorList";
import type { SearchParams } from "@/components/place-manage/MonitorPage";
import { ViewsLog } from "./ViewsLog";
import { ViewsAnalytics } from "./ViewsAnalytics";
import { ExportButton, MonitorToolbar } from "@/components/place-manage/ExportButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Views" };

// Views (MESITA-3206; one list since MESITA-4538, Pato: "REMOVE THE STUPID
// ANALYTICS … JUST DISPLAY LISTS"): who viewed, liked and shared, newest
// first. ?customer=<key> shows one guest's views. Analytics came back on top
// (MESITA-4675, Pato: "do add analytics at the top"), computed from the raw
// events on every load; hidden while one guest is filtered.
export default async function ViewsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const customer = customerParam((await searchParams).customer);
  const [views, log] = await Promise.all([getPlaceViews(id), listPlaceViewsLog(id, undefined, customer)]);
  if (!log.ok) return <MonitorError error={log.error} />;
  return (
    <div className="flex flex-col gap-4 pb-8">
      <MonitorToolbar>
        <ExportButton placeId={id} kind="views" filter={{ customer }} name="views" />
      </MonitorToolbar>
      {views.ok && !customer ? <ViewsAnalytics data={views.data} /> : null}
      <ViewsLog
        key={customer ?? ""}
        placeId={id}
        timezone={views.ok ? views.data.timezone : "America/Mexico_City"}
        initial={log.data}
        customer={customer}
      />
    </div>
  );
}
