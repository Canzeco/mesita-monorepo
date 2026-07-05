import { SlideOverLoadingSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Renders INSIDE the SlideOverShell mounted by layout.tsx — the panel is
// already sliding in while this skeleton waits for the server data.
export default function ModalSegmentLoading() {
  return <SlideOverLoadingSkeleton />;
}
