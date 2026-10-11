import { PlanModal } from "@/components/consumer/me/PlanModal";

// /me/plan — the plan you are on; Premium is Soon (MESITA-2134).
export const dynamic = "force-dynamic";

export default function Page() {
  return <PlanModal />;
}
