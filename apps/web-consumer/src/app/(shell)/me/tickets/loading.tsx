import { MeListSkeleton } from "@/components/consumer/activity/MeLists";

// The page's own frame while its reads are out (MESITA-2701).
export default function Loading() {
  return <MeListSkeleton title="Tickets" rail />;
}
