import { listPlaceVisits } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { VisitsPanel } from "./VisitsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visits" };

// Visits (MESITA-3202): the log, newest first. New visit is on Rewards for the
// moment (MESITA-3210). A record of the place's own till: no money moves through Mesita.
export default async function VisitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visits = await listPlaceVisits(id);
  return (
    <div className="flex flex-col gap-4 pb-8">
      {visits.ok ? (
        <VisitsPanel placeId={id} initial={visits.data} />
      ) : (
        <Card>
          <p className="font-semibold">Visits didn&apos;t load.</p>
          <p className="text-muted-foreground mt-1 text-sm">{visits.error}</p>
        </Card>
      )}
    </div>
  );
}
