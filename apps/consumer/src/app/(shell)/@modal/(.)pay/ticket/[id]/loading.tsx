import { TicketDetailsSkeleton } from "@/components/consumer/TicketDetailsSkeleton";

// Renders inside the BottomSheetShell mounted by layout.tsx. Same skeleton
// as the dynamic-import and client-fetch fallbacks, so the whole wait —
// route resolve → chunk load → data load — reads as ONE continuous frame.
export default function TicketModalLoading() {
  return <TicketDetailsSkeleton />;
}
