import { listCustomers } from "@/lib/business-api";
import { customerParam } from "@/lib/monitor";
import { CustomersList } from "@/components/place-manage/CustomersList";
import { MonitorCard, MonitorError } from "@/components/place-manage/MonitorList";
import type { SearchParams } from "@/components/place-manage/MonitorPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

// Customers (MESITA-4538, Pato: "it counts the people and how much you owe
// them"): guests with money rows here, what the place owes each, chips to
// their own lists. ?id=<customer key> shows one guest.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const customer = customerParam((await searchParams).id);
  const r = await listCustomers(id, customer);
  if (!r.ok) return <MonitorError code={r.code} error={r.error} />;
  return (
    <div className="flex flex-col gap-4 pb-8">
      <MonitorCard>
        <CustomersList key={customer ?? ""} placeId={id} initial={r.data} customer={customer} />
      </MonitorCard>
    </div>
  );
}
