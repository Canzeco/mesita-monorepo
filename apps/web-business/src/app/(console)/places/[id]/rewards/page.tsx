import { SoonCard } from "@/components/shell/SoonCard";

export const metadata = { title: "Rewards" };

// Rewards is not on yet: the box says Soon and explains nothing
// (MESITA-3171).
export default function RewardsPage() {
  return (
    <div className="flex flex-col gap-3 pb-8">
      <SoonCard />
    </div>
  );
}
