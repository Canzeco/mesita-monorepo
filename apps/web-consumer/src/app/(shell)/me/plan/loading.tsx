// /me/plan's fallback is the page's own frame with nothing fetched: the two
// plan rows and their words, no Current pill, no button (Pato, MESITA-2701:
// "the placeholders must be similar to the page you are loading").
import { PlanModal } from "@/components/consumer/me/PlanModal";

export default function PlanLoading() {
  return <PlanModal fallback />;
}
