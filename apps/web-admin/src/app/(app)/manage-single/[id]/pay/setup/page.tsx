import Link from "next/link";
import { notFound } from "next/navigation";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { MesitaPayCard } from "@/components/console/MesitaPayCard";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import { Section } from "@/components/shared/Section";
import {
  apiConsoleCatalog,
  apiGetPaymentAccount,
  paymentAccountState,
  type PaymentAccount,
} from "@/lib/api/console";
import { findPlace } from "@/lib/active-place";
import { placeTabHref } from "@/lib/place-tabs";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { createServerSupabase } from "@/lib/supabase/server";

// Payments' controls — the Stripe account, a seam, the switch. Business's
// page over admin's catalogue read; the operator acts as the owner.
export const dynamic = "force-dynamic";

export default async function AdminMesitaPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createServerSupabase();
  const place = findPlace((await apiConsoleCatalog(supabase)).places, id);
  if (!place) notFound();
  const partnered = place.partnered === true;
  const connect = typeof sp.connect === "string" ? sp.connect : undefined;
  if (!partnered) {
    return (
      <Section
        lane
        title="Needs Mesita Partner"
        description="Online Payments is an add-on on top of this place's yearly partnership."
      >
        <Link className={CTA_BUTTON_CLASS} href={placeTabHref(id, "pay")}>
          Back to Payments
        </Link>
      </Section>
    );
  }
  let account: PaymentAccount | null = null;
  let orphaned = false;
  let accountError: string | null = null;
  try {
    ({ account, orphaned } = await apiGetPaymentAccount(supabase, id));
  } catch (e) {
    accountError = "Couldn't load the Stripe account.";
    console.error("[manage-single/pay] business-web-get-payment-account:", e);
  }
  const stripeReady =
    accountError === null &&
    account !== null &&
    account.charges_enabled === true &&
    account.details_submitted === true &&
    !orphaned;
  return (
    <>
      <p className="text-muted-foreground text-sm leading-snug">
        Card payments inside Mesita, through {place.name}&apos;s own Stripe
        account.
      </p>
      <ConnectReturnNotice connect={connect} />
      <Section
        lane
        title="Stripe account"
        description="Mesita charges guests on this account and Stripe pays it out."
      >
        <PaymentsCard
          placeId={id}
          account={account}
          orphaned={orphaned}
          isOwner
          loadError={accountError}
        />
        <div className="border-border/60 border-t pt-3">
          <MesitaPayCard
            key={`mesita-pay-${place.mesitaPayEnabled === true}`}
            placeId={id}
            partnered
            stripeReady={stripeReady}
            mesitaPayEnabled={place.mesitaPayEnabled === true}
            isOwner
            accountState={paymentAccountState(account, orphaned)}
            orphaned={orphaned}
            loadError={accountError}
          />
        </div>
      </Section>
    </>
  );
}
