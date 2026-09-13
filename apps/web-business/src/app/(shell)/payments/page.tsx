// Payments — "org & place payments (a settings thing)" (Pato, 2026-09-13;
// MESITA-1832): the selected organization's money. Stripe Account · Partner ·
// Prepaid Credits, the boxes the organization page held until the six-page
// console. Stripe sends the owner back here: an Account Link's return_url is
// minted against `/orgs/<id>?connect=…`, which selects the organization and
// forwards to this page with the query intact.
import { redirect } from "next/navigation";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { NoPlaceYet } from "@/components/console/NoPlaceYet";
import { OrgStateBadge } from "@/components/console/badges";
import { PaymentsSections } from "@/components/console/OrgScreenSections";
import { apiGetPaymentAccount, type PaymentAccount } from "@/lib/api/organizations";
import { getSelection } from "@/lib/selected-place";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, sp] = await Promise.all([getServerUser(), searchParams]);
  if (!user) redirect("/signin?next=/payments");
  const { org } = await getSelection();
  if (!org) return <NoPlaceYet org={null} />;
  const supabase = await createServerSupabase();

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
