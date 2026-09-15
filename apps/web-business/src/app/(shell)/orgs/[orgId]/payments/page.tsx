// Payments — PARKED (MESITA-1852). Pato: *"put payments as soon too for the
// moment."*
//
// Its two live boxes moved to Configuration, where they belong: a Stripe
// account is connected once and a Partner switch is flipped once, and both
// are setup, not reading. What Payments is FOR is what happened — what guests
// paid and what reached the account — and none of that is built.
//
// THE ROW STAYS. Pato said "for the moment", so the address, the rail row and
// every bookmark survive the pause; only the contents wait. An unbuilt engine
// shows Soon on its PAGE and never a dimmed row in the rail (MESITA-1833).
//
// STRIPE'S STORED RETURN still lands here. An Account Link minted months ago
// points at `/orgs/<id>?connect=return`, and the bare address forwards that
// query onward — it is answered by the notice, which travels with the Stripe
// box to Configuration.
import { notFound, redirect } from "next/navigation";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { apiListOrganizations } from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import { orgHref } from "@/lib/console-routes";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, sp, { orgId }] = await Promise.all([
    getServerUser(),
    searchParams,
    params,
  ]);
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId, "payments"))}`);
  }
  const supabase = await createServerSupabase();
  const org = findOrg(await apiListOrganizations(supabase), orgId);
  if (!org) notFound();
  const connect = typeof sp.connect === "string" ? sp.connect : undefined;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Payments</h1>
      <ConnectReturnNotice connect={connect} />
      <SoonStrip {...SOON_STRIPS.payments} />
      <SoonStrip {...SOON_STRIPS.credits} />
    </>
  );
}
