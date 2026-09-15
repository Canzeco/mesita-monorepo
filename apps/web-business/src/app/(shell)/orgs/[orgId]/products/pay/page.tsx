// Mesita Pay — the organization's Stripe account, at its own address
// (MESITA-1872).
//
// Pato, on the catalogue with this box at the foot of it: *"remove thus shit.
// just leave the 8 boxes and the 1 partnership box shit."*
//
// THE BOX DID NOT DIE, IT MOVED. The catalogue is a grid of eight products and
// a banner; a full Section hanging under it made one of the eight louder than
// the other seven on the page whose whole job is to compare them. So Mesita
// Pay's controls get a page, and the catalogue keeps its shape.
//
// IT IS A SUB-STEP, NOT A ROW. `/orgs/<id>/products/pay` is the same shape
// `/orgs/<id>/places/new` already is: an address beneath the page it belongs
// to, reached from that page, lighting that page's rail row (see
// `orgTargetFromPathname`). It is not in ORG_PAGES, so the rail never grows a
// ninth row for one product's setup.
//
// A REAL ADDRESS, NOT AN ANCHOR. The card's verb used to be `#mesita-pay`,
// which scrolled to the Section below the grid. With the Section gone an
// anchor would scroll nowhere — silently, which is the worst kind of dead
// link. A link that navigates cannot fail that way, and it is shareable,
// which `#mesita-pay` never was.
//
// STRIPE'S STORED RETURN LANDS HERE. An Account Link minted months ago points
// at `/orgs/<id>?connect=return`; the bare address forwards the whole query,
// and it now forwards it here rather than at the catalogue, because this is
// where the notice and the account it is about both live.
//
// THE COMPOSITION IS MESITA-1866's, UNCHANGED: the account (`PaymentsCard`),
// one seam, and the switch it unlocks (`MesitaPayCard`). And the PARTNER GATE
// is unchanged too — Mesita Pay rides on Mesita Partner (MESITA-1867), so a
// non-partner gets the one next step rather than a locked box: the catalogue
// card already reads "Locked · Needs Mesita Partner", and this page says the
// same thing once, with the door.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { MesitaPayCard } from "@/components/console/MesitaPayCard";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import { Section } from "@/components/shared/Section";
import {
  apiGetPaymentAccount,
  apiListOrganizations,
  paymentAccountState,
  type PaymentAccount,
} from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import { orgHref, orgPayHref } from "@/lib/console-routes";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MesitaPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgId }, sp] = await Promise.all([params, searchParams]);
  const user = await getServerUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgPayHref(orgId))}`);
  }
  const supabase = await createServerSupabase();
  const org = findOrg(await apiListOrganizations(supabase), orgId);
  if (!org) notFound();

  const isOwner = org.myRole === "owner";
  const partnered = org.partnered === true;
  const connect = typeof sp.connect === "string" ? sp.connect : undefined;

  const heading = (
    <div className="flex flex-col gap-1">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Mesita Pay
      </h1>
      <p className="text-muted-foreground text-sm leading-snug">
        Card payments inside Mesita, through {org.name}&apos;s own Stripe
        account.
      </p>
    </div>
  );

  // NOT A PARTNER: one sentence and the door, never a locked box. The
  // catalogue card this page was opened from already says "Locked · Needs
  // Mesita Partner"; saying it twice in two shapes is the redundancy this
  // whole pass has been deleting.
  if (!partnered) {
    return (
      <>
        {heading}
        <Section
          lane
          title="Needs Mesita Partner"
          description="Mesita Pay is an add-on on top of the organization's yearly partnership."
        >
          <Link className={CTA_BUTTON_CLASS} href={orgHref(org.id, "products")}>
            Back to Products
          </Link>
        </Section>
      </>
    );
  }

  // Partnered: the account, read ONCE. A failure is no box state, never a box
  // that asserts "not connected" about an account nobody managed to ask about
  // — the flag is what tells a blip from a genuine absence (MESITA-1861), and
  // without it a live, charging account gets offered a second one.
  let account: PaymentAccount | null = null;
  let orphaned = false;
  let accountError: string | null = null;
  try {
    ({ account, orphaned } = await apiGetPaymentAccount(supabase, org.id));
  } catch (e) {
    accountError = "Couldn't load the Stripe account.";
    console.error("[products/pay] business-web-get-payment-account:", e);
  }

  // A failed read is NOT "not ready" — it is unknown. The switch stays locked
  // either way (the lock is the safe default), but the reason it gives must
  // not be a claim about an account nobody managed to fetch.
  const stripeReady =
    accountError === null &&
    account !== null &&
    account.charges_enabled === true &&
    account.details_submitted === true &&
    !orphaned;

  return (
    <>
      {heading}
      <ConnectReturnNotice connect={connect} />
      <Section
        lane
        title="Stripe account"
        description="Mesita charges guests on this account and Stripe pays it out."
      >
        <PaymentsCard
          orgId={org.id}
          account={account}
          orphaned={orphaned}
          isOwner={isOwner}
          loadError={accountError}
        />
        {/* ONE SEAM, inside one box (MESITA-1866): the account above, the
            switch it unlocks below. Not a second box — the prerequisite and
            the thing it gates are one subject. */}
        <div className="border-border/60 border-t pt-3">
          <MesitaPayCard
            partnered
            stripeReady={stripeReady}
            mesitaPayEnabled={org.mesitaPayEnabled === true}
            isOwner={isOwner}
            accountState={paymentAccountState(account, orphaned)}
            orphaned={orphaned}
            loadError={accountError}
          />
        </div>
      </Section>
    </>
  );
}
