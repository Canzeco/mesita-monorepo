// Organization — THE ORGANIZATION itself: what it is, who is in it, what it
// holds.
//
// A page again, after two days as nothing. MESITA-1810 made it one page;
// MESITA-1832 dissolved it into Account, splitting its money onto Payments,
// its Members onto /settings and its Places into a switcher menu; MESITA-1840
// merged what was left into a single card. Pato's 2026-09-14 drawing names it
// row one of the rail, so it is an address again — and it is the door to the
// two pages that have no rail row of their own.
//
// IT IS NOT A SECOND ACCOUNT. Account answers "who am I, and which
// organization and place am I in" — the person and the two switchers. This
// answers "what is this organization": its name, its members, its places.
// Nothing here switches anything.
//
// ONE BOX, ROWS DIVIDED BY HAIRLINES (MESITA-1840's law, which survives the
// rail change): Members and Places are one scope read top to bottom, not two
// unrelated cards with a gap between them. Full width — no cap was asked for
// (MESITA-1836).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Layers, Plus, Users } from "lucide-react";
import { OrgStateBadge } from "@/components/console/badges";
import {
  apiGetPaymentAccount,
  apiListOrganizations,
  type PaymentAccount,
} from "@/lib/api/organizations";
import { canAddPlace, findOrg } from "@/lib/active-organization";
import { orgHref, orgPlacesHref, orgPlacesNewHref } from "@/lib/console-routes";
import {
  GHOST_PILL_BUTTON_CLASS,
  SCOPE_CARD_CLASS,
  SCOPE_CHIP_CLASS,
  SCOPE_ROW_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;

const CHIP = cn(
  SCOPE_CHIP_CLASS,
  "bg-muted text-muted-foreground ring-border flex items-center justify-center ring-1",
);

/** One door: a chip, an eyebrow, the count it leads to, a chevron. The whole
 *  row is the target — a 12px text link is not enough affordance for a page. */
function DoorRow({
  href,
  eyebrow,
  title,
  meta,
  Icon,
}: {
  href: string;
  eyebrow: string;
  title: string;
  meta: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className={cn(
        SCOPE_ROW_CLASS,
        "transition hover:bg-muted/50",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span aria-hidden className={CHIP}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={TINY_LABEL_CLASS}>{eyebrow}</span>
        <span className="mt-0.5 truncate text-base font-semibold">{title}</span>
        <span className="text-muted-foreground truncate text-[12px]">{meta}</span>
      </span>
      <ChevronRight aria-hidden className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
    </Link>
  );
}

export default async function OrganizationPage(props: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await props.params;
  const user = await getServerUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId, "organization"))}`);
  }
  const supabase = await createServerSupabase();
  // The segment layout above already refused a foreign id; this read is for
  // the organization's name, role and holdings, which are the page.
  const org = findOrg(await apiListOrganizations(supabase), orgId);
  if (!org) notFound();

  // The Stripe state rides the header as a badge, not a box: the box lives on
  // Payments, and two places offering the same switch is how a console starts
  // disagreeing with itself. A failed read is simply no badge — never a badge
  // that asserts "not connected" about an account nobody managed to ask about.
  let account: PaymentAccount | null = null;
  try {
    ({ account } = await apiGetPaymentAccount(supabase, org.id));
  } catch (e) {
    console.error("[organization] business-web-get-payment-account:", e);
  }

  const n = org.places.length;
  const placesMeta = n === 0 ? "None yet" : n === 1 ? "1 place" : `${n} places`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {org.name}
        </h1>
        <OrgStateBadge
          state={account?.charges_enabled ? "connected" : "not_connected"}
        />
      </div>
      <p className="text-muted-foreground text-sm leading-snug">
        You are {ROLE_LABEL[org.myRole]} here. {placesMeta}.
      </p>

      <div className={SCOPE_CARD_CLASS}>
        <DoorRow
          href={orgHref(org.id, "members")}
          eyebrow="Members"
          title="Who can sign in"
          meta="People in this organization, and at what role"
          Icon={Users}
        />
        <DoorRow
          href={orgPlacesHref(org.id)}
          eyebrow="Places"
          title={placesMeta}
          meta="What this organization holds, and what it can claim"
          Icon={Layers}
        />
      </div>

      {canAddPlace(org.myRole) && (
        <div>
          <Link href={orgPlacesNewHref(org.id)} className={GHOST_PILL_BUTTON_CLASS}>
            <Plus className="h-3.5 w-3.5" />
            Add place
          </Link>
        </div>
      )}
    </>
  );
}
