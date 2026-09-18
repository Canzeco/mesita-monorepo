// Mesita Pay — the place's Stripe account, at its own address (MESITA-1872).
//
// Pato, on the catalogue with this box at the foot of it: *"remove thus shit.
// just leave the 8 boxes and the 1 partnership box shit."*
//
// THE BOX DID NOT DIE, IT MOVED. The catalogue is a grid of eight products and
// a banner; a full Section hanging under it made one of the eight louder than
// the other seven on the page whose whole job is to compare them. So Mesita
// Pay's controls get a page, and the catalogue keeps its shape.
//
// IT IS A SUB-STEP, NOT A ROW. `/places/<id>/products/pay` is a page beneath
// the one it belongs to, reached from that page, lighting that page's rail row
// (see `placePageFromPathname`). It is not in PLACE_PAGES, so the rail never
// grows a fifth page row for one product's setup.
//
// ── TWO PAY SCREENS, AND THEY ARE NOT THE SAME SCREEN ─────────────────────
//
// `/places/<id>/pay` is the product VIEW: the `pay` rung of the ladder, the
// thing an operator flips while running the place. THIS is the SETUP: the
// Stripe account the money lands in, and the `mesita_pay_enabled` switch that
// account unlocks. The split used to be organization-versus-place
// (MESITA-1867); since MESITA-1892 both are the place's, and the line between
// them is buying a product versus running it — the same line every other card
// on the catalogue draws. The view links up here; this page never draws the
// ladder.
//
// A REAL ADDRESS, NOT AN ANCHOR. The card's verb used to be `#mesita-pay`,
// which scrolled to the Section below the grid. With the Section gone an
// anchor would scroll nowhere — silently, which is the worst kind of dead
// link. A link that navigates cannot fail that way, and it is shareable,
// which `#mesita-pay` never was.
//
// STRIPE'S STORED RETURN LANDS HERE. An Account Link minted months ago points
// at the bare place address (`/places/<id>?connect=return`, and before
// MESITA-1892 at `/orgs/<id>?connect=return`, which `next.config.ts` forwards
// through `/`); the bare address forwards the whole query here, because this
// is where the notice and the account it is about both live.
//
// THE SWITCH IS LIVE FOR AN OWNER (MESITA-1891). `MesitaPayCard` writes
// `place_profiles.mesita_pay_enabled` through `business-web-set-place-rails`,
// whose `mesita_pay` key is owner-only, and refreshes this route afterwards.
// Everything this page computes above it — `partnered`, `stripeReady`, the
// account state — is still what decides whether that branch is reachable at
// all, so the lock lives here and the control lives there.
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
  apiMyPlaces,
  paymentAccountState,
  type PaymentAccount,
} from "@/lib/api/console";
import { findPlace } from "@/lib/active-place";
import { placePageHref, placePayHref } from "@/lib/console-routes";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MesitaPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getServerUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(placePayHref(id))}`);
  }
  const supabase = await createServerSupabase();
  const place = findPlace(await apiMyPlaces(supabase), id);
  if (!place) notFound();

  const isOwner = place.myRole === "owner";
  const partnered = place.partnered === true;
  const connect = typeof sp.connect === "string" ? sp.connect : undefined;

  // NOT A PARTNER: one sentence and the door, never a locked box. The
  // catalogue card this page was opened from already says "Locked · Needs
  // Mesita Partner"; saying it twice in two shapes is the redundancy this
  // whole pass has been deleting.
  if (!partnered) {
    return (
      <Section
        lane
        title="Needs Mesita Partner"
        description="Online Payments is an add-on on top of this place's yearly partnership."
      >
        <Link className={CTA_BUTTON_CLASS} href={placePayHref(id)}>
          Back to Products
        </Link>
      </Section>
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
    ({ account, orphaned } = await apiGetPaymentAccount(supabase, id));
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
          isOwner={isOwner}
          loadError={accountError}
        />
        {/* ONE SEAM, inside one box (MESITA-1866): the account above, the
            switch it unlocks below. Not a second box — the prerequisite and
            the thing it gates are one subject. */}
        <div className="border-border/60 border-t pt-3">
          {/* THE `key=` IS THE RE-SEED (MESITA-1891). The switch keeps its own
              `on` so a click answers immediately; this remounts it whenever
              the server's bit changes, so a fresher server render always wins
              over a stale local copy. */}
          <MesitaPayCard
            key={`mesita-pay-${place.mesitaPayEnabled === true}`}
            placeId={id}
            partnered
            stripeReady={stripeReady}
            mesitaPayEnabled={place.mesitaPayEnabled === true}
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
