import { TicketSkeleton } from "@/components/consumer/rewards/TicketSkeleton";

// First-frame silhouette of THE TICKET (MESITA-1029 S2 · MESITA-1336).
// Only hard loads and deep links ever see this route file — the in-app tap
// path arrives seeded and paints content on the first frame. List-load uses
// the same `TicketSkeleton` so the two paths cannot drift.
export default function TicketLoading() {
  return <TicketSkeleton />;
}
