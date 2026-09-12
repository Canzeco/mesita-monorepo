import { PlanModal } from "@/components/consumer/me/PlanModal";

// /me/plan — subscribe. Canonical again after MESITA-188; was a sheet (MESITA-1129, MESITA-1789).
export const dynamic = "force-dynamic";

export default function Page() {
  return <PlanModal />;
}
