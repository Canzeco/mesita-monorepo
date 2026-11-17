import { redirect } from "next/navigation";
import { withNext, safeNextPath } from "@/lib/auth-redirect";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// ONBOARDING LIVES ON SIGN NOW (MESITA-4246): phone, code and the profile on
// one page with the bar showing. /onboard forwards there with its `next`, by
// a temporary redirect while anonymous mode is new (a cached 308 would
// outlive a rollback of the ANONYMOUS_BROWSE switch). OnboardForm.tsx stays
// here and is drawn by /sign.
export const dynamic = "force-dynamic";

export default async function ConsumerOnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  redirect(withNext(CONSUMER_ROUTES.sign, next));
}
