"use client";

import { PlanModal } from "@/components/consumer/me/PlanModal";
import { toGuestPlan } from "@/lib/guest-standing";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import PlanLoading from "./loading";

// The plan from the kept profile row (MESITA-3014): no server read on the way
// in. A failed read shows both plans with neither marked, never a guessed Free.
export function PlanFromProfile() {
  const { data, loading } = useConsumerProfile();
  if (loading) return <PlanLoading />;
  return <PlanModal plan={data ? toGuestPlan(data.plan) : null} />;
}
