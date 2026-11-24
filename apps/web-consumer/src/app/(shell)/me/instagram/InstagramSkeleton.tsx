import { VipFrame } from "@/components/consumer/me/VipModal";

/** /me/instagram's fallback. */
export function InstagramSkeleton() {
  return (
    <VipFrame>
      <div className="bg-muted h-56 animate-pulse rounded-2xl" aria-hidden />
      <p role="status" className="sr-only">
        Loading Class
      </p>
    </VipFrame>
  );
}
