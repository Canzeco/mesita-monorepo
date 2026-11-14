// /me/plan's fallback is the page itself: Plan is Soon on screen and reads
// nothing (MESITA-3835), so the placeholder and the page are one box (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading").
import { PlanModal } from "@/components/consumer/me/PlanModal";

export default function PlanLoading() {
  return <PlanModal />;
}
