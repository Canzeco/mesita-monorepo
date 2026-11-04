import { listPlaceVisits } from "@/lib/business-api";
import { getManagePlace } from "@/lib/place-view";
import { Card } from "@/components/shell/Page";
import { ProfileStatsCard } from "@/components/place-manage/sections/ProfileStatsCard";
import { VisitsPanel } from "./VisitsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visits" };

// Visits (MESITA-3202): log a visit from the guest's code, and the log, newest
// first. A record of the place's own till: no money moves through Mesita.
// Profile Stats moved here from Admin (MESITA-3205). Staff only: business-web-get-place
// sends the counts to a super-admin alone.
export default async function VisitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [visits, manage] = await Promise.all([listPlaceVisits(id), getManagePlace(id)]);
  return (
    <div className="flex flex-col gap-4 pb-8">
      {manage?.role === "superadmin" ? <ProfileStatsCard place={manage.place} /> : null}
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
