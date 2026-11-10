import { Skeleton } from "@/components/shared";
import { WalletCardSkeleton } from "@/components/consumer/wallet/WalletCard";

// A House Card's frame (MESITA-2701): the header bar and the card in bones.
export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy>
      <div className="border-border bg-card flex h-[3.75rem] items-center gap-2 border-b px-4">
        <Skeleton className="h-5 w-40 rounded-md" />
      </div>
      <div className="px-4 pt-5">
        <WalletCardSkeleton count={1} />
      </div>
    </div>
  );
}
