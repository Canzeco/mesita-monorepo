import { WalletCardSkeleton } from "@/components/consumer/wallet/WalletCard";

// Wallet's frame: the page as it will land, title and lead in place and the
// house cards in bones (MESITA-3511) (Pato, MESITA-2701: "the placeholders must be similar
// to the page you are loading, like the sizes"). (shell)/shell-loading.tsx
// draws it on a tap from another tab too.
export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col px-4 pt-6 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Wallet</h1>
      <p className="text-muted-foreground type-body mt-1">
        Your credit at each place, ready for your next visit.
      </p>
      <div className="mt-5">
        <WalletCardSkeleton />
      </div>
    </div>
  );
}
