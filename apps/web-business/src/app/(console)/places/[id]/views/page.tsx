import { getPlaceViews, listPlaceViewsLog } from "@/lib/business-api";
import { customerParam } from "@/lib/monitor";
import { MonitorError } from "@/components/place-manage/MonitorList";
import type { SearchParams } from "@/components/place-manage/MonitorPage";
import { ViewsLog } from "./ViewsLog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Views" };

// Views (MESITA-3206; one list since MESITA-4538, Pato: "REMOVE THE STUPID
// ANALYTICS … JUST DISPLAY LISTS"): who viewed, liked and shared, newest
// first. No chart, no counts. ?customer=<key> shows one guest's views.
export default async function ViewsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const customer = customerParam((await searchParams).customer);
  const [views, log] = await Promise.all([getPlaceViews(id), listPlaceViewsLog(id, undefined, customer)]);
  if (!log.ok) return <MonitorError error={log.error} />;
  return (
    <div className="flex flex-col gap-4 pb-8">
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
