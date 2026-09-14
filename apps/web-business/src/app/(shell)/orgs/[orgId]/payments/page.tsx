// Payments — THE ORGANIZATION's money: Stripe Account · Partner · Prepaid
// Credits (Pato, 2026-09-13, "org & place payments (a settings thing)").
//
// It sat at the flat `/payments` from MESITA-1832 until MESITA-1839, reading
// whichever organization a cookie named. It is under the organization now,
// because that is whose money it is — and because Stripe needs to be able to
// send an owner back to a SPECIFIC one. An Account Link's return_url is minted
// against `/orgs/<id>?connect=…`, which forwards here with the query intact;
// the flat `/payments` still resolves the remembered organization and lands
// here too.
import { notFound, redirect } from "next/navigation";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { OrgStateBadge } from "@/components/console/badges";
import { PaymentsSections } from "@/components/console/OrgScreenSections";
import {
  apiGetPaymentAccount,
  apiListOrganizations,
  type PaymentAccount,
} from "@/lib/api/organizations";
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
  // The segment layout above already refused a foreign id; this read is for
  // the org's own name and role, which the money boxes render.
  const org = findOrg(await apiListOrganizations(supabase), orgId);
  if (!org) notFound();

  let account: PaymentAccount | null = null;
  let orphaned = false;
  try {
    ({ account, orphaned } = await apiGetPaymentAccount(supabase, org.id));
  } catch (e) {
    console.error("[payments] business-web-get-payment-account:", e);
  }
  const connect = typeof sp.connect === "string" ? sp.connect : undefined;

  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Payments</h1>
        <OrgStateBadge state={account?.charges_enabled ? "connected" : "not_connected"} />
      </div>
      <ConnectReturnNotice connect={connect} />
      <PaymentsSections org={org} account={account} orphaned={orphaned} />
    </>
  );
}
