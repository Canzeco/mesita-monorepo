import { Skeleton } from "@/components/shared/Skeleton";

// Pay's Wallet loading frame (pay/PayFrameLoading.tsx) draws this under the
// Credits Payment Methods heading. Since MESITA-3741 a Credits Card is a row
// (WalletLists' CreditsRow), so its bones are one white card holding one
// row: the chip and two lines. MESITA-3736's band with transactions and
// Fund | Gift left the Wallet.

export function CreditsCardSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border" aria-hidden>
      <div className="flex min-h-16 items-center gap-3.5 px-4 py-3">
        <Skeleton className="h-8 w-[3.2rem] shrink-0 rounded-md" />
        <span className="flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-1.5 h-3 w-24" />
        </span>
      </div>
    </div>
  );
}
