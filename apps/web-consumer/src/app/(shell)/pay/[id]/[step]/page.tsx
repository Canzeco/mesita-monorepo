import { redirect } from "next/navigation";
import { CONSUMER_ROUTES, isRewardStep } from "@/lib/consumer-route-contract";

// The address of one step. The sheet in the layout above draws it; this only
// refuses a step that doesn't exist (MESITA-3254).
export default async function PayStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!isRewardStep(step)) redirect(CONSUMER_ROUTES.pay);
  return null;
}
