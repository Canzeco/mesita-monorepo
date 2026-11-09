import { FeedbackFrame } from "@/components/consumer/me/FeedbackModal";
import { Skeleton } from "@/components/shared";

// /me/settings/feedback's fallback: FeedbackModal's own frame (MESITA-2701),
// the title and lead line as themselves, the box and Send as silhouettes at
// their sizes.
export default function FeedbackLoading() {
  return (
    <FeedbackFrame>
      <Skeleton className="h-[144px] w-full rounded-2xl" />
      <Skeleton className="mt-5 h-12 w-full rounded-lg" />
      <p role="status" className="sr-only">
        Loading feedback
      </p>
    </FeedbackFrame>
  );
}
