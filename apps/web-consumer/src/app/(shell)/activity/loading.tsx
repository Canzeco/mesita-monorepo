import { ActivityFrame, RowsSkeleton } from "@/components/consumer/activity/ActivityPage";

// /activity's frame: the header in place, the list in bones (MESITA-2701).
export default function ActivityLoading() {
  return (
    <ActivityFrame>
      <RowsSkeleton />
      <p role="status" className="sr-only">
        Loading activity
      </p>
    </ActivityFrame>
  );
}
