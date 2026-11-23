import { listMonitor } from "@/lib/business-api";
import { customerParam, uuidParam } from "@/lib/monitor";
import { ExportButton, MonitorToolbar } from "@/components/place-manage/ExportButton";
import { MonitorAnalytics } from "@/components/place-manage/MonitorAnalytics";
import { MonitorCard, MonitorError } from "@/components/place-manage/MonitorList";
import type { SearchParams } from "@/components/place-manage/MonitorPage";
import { VisitRows } from "@/components/place-manage/VisitRows";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visits" };

// Visits (MESITA-4538): every bill, one list, each linked to the payments that
// paid it. Expandable rows since MESITA-4732 (design review 2026-11-23), not a
// table. No off state: Mesita Credits are always accepted.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = { id: uuidParam(sp.id), customer: customerParam(sp.customer) };
  const r = await listMonitor(id, "visits", filter);
  if (!r.ok) return <MonitorError code={r.code} error={r.error} />;
  // Analytics on top (MESITA-4677): first, unfiltered page only.
  const analytics = r.data.analytics ? ({ kind: "visits" as const, ...r.data.analytics } as Parameters<typeof MonitorAnalytics>[0]["analytics"]) : null;
  return (
    <div className="flex flex-col gap-4 pb-8">
      <MonitorToolbar>
        <ExportButton placeId={id} kind="visits" filter={filter} name="visits" />
      </MonitorToolbar>
      {analytics ? <MonitorAnalytics analytics={analytics} /> : null}
      <MonitorCard>
        <VisitRows
          key={`${filter.id ?? ""}|${filter.customer ?? ""}`}
          placeId={id}
          initial={r.data}
          filter={filter}
          clearHref={`/places/${encodeURIComponent(id)}/visits`}
        />
      </MonitorCard>
    </div>
  );
}
