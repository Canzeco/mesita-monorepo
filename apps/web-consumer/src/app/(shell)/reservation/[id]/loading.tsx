import { ReservationPageSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Hard-nav reservation while the route loads: the page's header and the
// reservation's silhouette (MESITA-2701: the loaded screen's blocks, at their
// sizes). It was the shell's centred spinner.
export default function ReservationPageLoading() {
  return <ReservationPageSkeleton />;
}
