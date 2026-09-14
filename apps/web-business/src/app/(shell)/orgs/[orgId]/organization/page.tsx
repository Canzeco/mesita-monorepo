// Organization — WHICH one you are in, WHO is in it, and WHAT it holds. All
// three on the page, none of them behind a door.
//
// Pato, 2026-09-14, on the version that shipped an hour earlier: *"this is
// redundant, make like boxes"*, then *"members and places in organization i
// mean, fuck nested things display shit there"*, then *"organization must be
// selected in organization not fucking there, account is just for there."*
//
// WHAT WAS REDUNDANT. Two `DoorRow`s, each naming its subject three ways and
// each a chevron you clicked THROUGH to reach content that could simply be
// here:
//
//   MEMBERS  Who can sign in  People in this organization, and at what role ›
//   PLACES   None yet         What this organization holds, and what it can claim ›
//
// An eyebrow, a title and a description are three chances to say one word, and
// a door is a box that refuses to show you anything. Both are gone.
//
// ONE BOX SHAPE, AND IT ALREADY EXISTED: `components/shared/Section.tsx` —
// a title, the content, and the box's own action in the `right` slot. Every
// box here NAMES ITS SUBJECT ONCE. `MembersCard` was already that shape with
// Invite in `right`, so folding `/orgs/<id>/members` in was moving two reads,
// not writing a screen.
//
// THE SELECTOR IS THE HEADING. `OrgSwitcher` carries the organization's name
// at full weight, so this page renders no visible `h1` repeating it — the
// heading is sr-only, which keeps the landmark without printing the word
// twice in 200px. A trigger is a `<button>`; a heading is not phrasing
// content and cannot live inside one.
//
// NO STRIPE BADGE. It stated Payments' fact on a page that no longer links to
// Payments — and Payments carries that same badge on its own heading, one rail
// row away. Removing it removed this page's `apiGetPaymentAccount` call with
// it: a page that shows nothing about Stripe has no reason to ask about it.
//
// PLACES HERE vs THE PLACES ROW. This box lists what the organization HOLDS,
// each name a link into that place. `/orgs/<id>/places` is the whole
// catalogue — the states matrix, the `?owned=` filters, Claim and Release over
// places nobody holds. If the two ever converge, one of them should die.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Plus, Store } from "lucide-react";
import { MembersCard } from "@/components/console/MembersCard";
import { OrgSwitcher } from "@/components/console/OrgSwitcher";
import { Section } from "@/components/shared/Section";
import {
  apiListOrgMembers,
  apiListOrganizations,
  type OrgMember,
  type PendingOrgInvite,
} from "@/lib/api/organizations";
import { canAddPlace, findOrg } from "@/lib/active-organization";
import { orgHref, orgPlacesHref, orgPlacesNewHref, placeHref } from "@/lib/console-routes";
import { GHOST_PILL_BUTTON_CLASS, SCOPE_CHIP_CLASS } from "@/lib/ui-classes";
import { placeThumbUrl } from "@/lib/place-thumb";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** One place the organization holds: its thumb, its name, and the way in.
 *  The whole row is the target — the name alone is not enough to hit. */
function PlaceRow({
  href,
  name,
  photoUrl,
}: {
  href: string;
  name: string;
  photoUrl: string | null;
}) {
  const src = placeThumbUrl(photoUrl, 36);
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left transition",
        "hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small thumb through the resizer; next/image's layout cost is not worth a chip
        <img
          src={src}
          alt=""
          width={36}
          height={36}
          className="ring-border h-9 w-9 shrink-0 rounded-lg object-cover ring-1"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            SCOPE_CHIP_CLASS,
            "bg-muted text-muted-foreground ring-border flex h-9 w-9 items-center justify-center rounded-lg ring-1",
          )}
        >
          <Store className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      <ChevronRight aria-hidden className="text-muted-foreground h-4 w-4 shrink-0" />
    </Link>
  );
}

export default async function OrganizationPage(props: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await props.params;
  const supabase = await createServerSupabase();
  // The segment layout above already refused a foreign id. These two reads are
  // the page: the organization's own record, and its people.
  const [user, organizations] = await Promise.all([
    getServerUser(),
    apiListOrganizations(supabase),
  ]);
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId))}`);
  }
  const org = findOrg(organizations, orgId);
  if (!org) notFound();

  let members: OrgMember[] = [];
  let pendingInvites: PendingOrgInvite[] = [];
  let membersError: string | null = null;
  try {
    ({ members, pendingInvites } = await apiListOrgMembers(supabase, org.id));
  } catch (e) {
    membersError = "Couldn't load members.";
    console.error("[organization] business-web-list-org-members:", e);
  }

  const canAdd = canAddPlace(org.myRole);
  const n = org.places.length;
  // CAPPED, because `org.places` is unbounded and this is the rail's first
  // row: a 200-place organization would render a 200-row box on the screen
  // the console opens to. The cap is on the RENDER — `n` above is the real
  // count, so the link below never lies about how many there are.
  const shown = org.places.slice(0, 10);

  return (
    <>
      <h1 className="sr-only">{org.name}</h1>

      <OrgSwitcher />

      <MembersCard
        orgId={org.id}
        members={members}
        pendingInvites={pendingInvites}
        myManagerId={user.id}
        isOwner={org.myRole === "owner"}
        loadError={membersError}
      />

      <Section
        title="Places"
        right={
          canAdd ? (
            <Link href={orgPlacesNewHref(org.id)} className={GHOST_PILL_BUTTON_CLASS}>
              <Plus className="h-3.5 w-3.5" />
              Add place
            </Link>
          ) : undefined
        }
      >
        {n === 0 ? (
          // No dashed tile inside a card — a dashed edge within a bordered box
          // reads as a rendering fault, not an invitation. One honest line, and
          // the action is already in the box's own `right` slot.
          <p className="text-muted-foreground text-sm">
            {canAdd
              ? "None yet. Add the first one."
              : "This organization holds none yet."}
          </p>
        ) : (
          <>
            <div className="-mx-2 flex flex-col">
              {shown.map((p) => (
                <PlaceRow
                  key={p.id}
                  href={placeHref(p.id)}
                  name={p.name}
                  photoUrl={p.photoUrl}
                />
              ))}
            </div>
            {/* The catalogue is the Places ROW's job — the matrix, the filters,
                Claim and Release. This is the way over to it, stated once. */}
            <Link
              href={orgPlacesHref(org.id)}
              className="text-muted-foreground hover:text-foreground w-fit text-[13px] underline underline-offset-2"
            >
              {n > shown.length
                ? `All ${n} places, and what this organization can claim`
                : "All places, and what this organization can claim"}
            </Link>
          </>
        )}
      </Section>
    </>
  );
}
