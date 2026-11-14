import { MeListSkeleton } from "@/components/consumer/activity/MeLists";

// The page's own frame while its read is out (MESITA-2701).
export default function Loading() {
  return <MeListSkeleton title="Reservations" rail={2} />;
}
