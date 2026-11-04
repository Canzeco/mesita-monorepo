import { getPlaceRewards } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { RewardsCard } from "./RewardsCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };

// Rewards (MESITA-3202, Pato: "On or off, not in between points"): four
// switches and the Cap. The log of who used them is Visits.
export default async function RewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rewards = await getPlaceRewards(id);
  return (
    <div className="flex flex-col gap-4 pb-8">
      {rewards.ok ? (
        <RewardsCard placeId={id} initial={rewards.data} canEdit={rewards.data.can_edit} />
      ) : (
        <Card>
          <p className="font-semibold">Rewards didn&apos;t load.</p>
          <p className="text-muted-foreground mt-1 text-sm">{rewards.error}</p>
        </Card>
      )}
    </div>
  );
}
