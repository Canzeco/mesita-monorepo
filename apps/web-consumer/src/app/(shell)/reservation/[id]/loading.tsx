import { ReservationPageSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Hard-nav reservation while the route loads: the page's own frame
// (ReservationPageFrame, its header and scroller) around the reservation's
// silhouette, the loaded screen's blocks at their sizes (Pato, MESITA-2701:
// "the placeholders must be similar to the page you are loading, like the
// sizes"). It was the shell's centred spinner.
export default function ReservationPageLoading() {
  return <ReservationPageSkeleton />;
}
