import { MeScreen } from "@/components/consumer/me/MeScreen";
import { Skeleton } from "@/components/shared/Skeleton";

// /me/gift's frame while the Wallet read is out (MESITA-2701).
export default function GiftLoading() {
  return (
    <MeScreen title="Gift">
      <Skeleton className="mx-1 h-4 w-64" />
      <Skeleton className="mt-5 h-40 w-full rounded-2xl" />
    </MeScreen>
  );
}
