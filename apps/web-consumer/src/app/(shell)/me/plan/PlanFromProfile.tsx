"use client";

// Plan is Soon on screen (MESITA-3835): the page reads no profile, so it
// draws at once. The name stays so the route file does not change.
import { PlanModal } from "@/components/consumer/me/PlanModal";

export function PlanFromProfile() {
  return <PlanModal />;
}
