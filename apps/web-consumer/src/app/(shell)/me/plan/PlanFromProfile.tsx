"use client";

// Me › Plan reads its own server answer (consumer-web-get-plan, MESITA-3870),
// not the profile. The name stays so the route file does not change.
import { PlanModal } from "@/components/consumer/me/PlanModal";

export function PlanFromProfile() {
  return <PlanModal />;
}
