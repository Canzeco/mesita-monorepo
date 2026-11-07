import { getPlaceRewards } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { HowItWorks } from "./HowItWorks";
import { PlaceCode } from "./PlaceCode";
import { RewardsCard } from "./RewardsCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discounts" };

// Discounts (Rewards until MESITA-3296; the data, EFs and guest screens keep
// "reward"; MESITA-3202, Pato: "On or off, not in between points"): four
// switches, the Cap and the total (MESITA-3228), then the place code (MESITA-3226). A visit is never
// registered here: Pato, "never. there they only set the fucking number". The log
// is Visits.
export default async function DiscountsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rewards = await getPlaceRewards(id);
  return (
    <div className="flex flex-col gap-4 pb-8">
      {rewards.ok ? (
        <>
          <RewardsCard placeId={id} initial={rewards.data} canEdit={rewards.data.can_edit} />
          <PlaceCode placeId={id} initialSet={rewards.data.code_set} canEdit={rewards.data.can_edit} />
          <HowItWorks />
        </>
      ) : (
        <Card>
          <p className="font-semibold">Discounts didn&apos;t load.</p>
          <p className="text-muted-foreground mt-1 text-sm">{rewards.error}</p>
        </Card>
      )}
    </div>
  );
}
