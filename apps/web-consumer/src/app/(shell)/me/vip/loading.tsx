import { VipFrame } from "@/components/consumer/me/VipModal";
import { Skeleton } from "@/components/shared";

// /me/vip's fallback (MESITA-2701): the page's frame, its two boxes in bones.
export default function VipLoading() {
  return (
    <VipFrame>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-5 w-4/5 rounded-md" />
        <Skeleton className="h-[74px] w-full rounded-2xl" />
        <Skeleton className="h-[170px] w-full rounded-2xl" />
      </div>
      <p role="status" className="sr-only">
        Loading Become VIP
      </p>
    </VipFrame>
  );
}
