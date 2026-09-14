// Account — the signed-in human, and the two switchers (MESITA-1832):
// which organization, which place. The organization's places (the list, Add
// place) are reached from the place switcher's menu.
//
// THE "YOU" CARD IS GONE (MESITA-1833). Pato, 2026-09-14: "make this prettier
// … far prettier". It held two rows of trivia — an email and a count — inside
// the page's only card, while the two switchers the page EXISTS for floated
// naked on the background at 40px tall. The weight was exactly backwards, and
// a card earns its border by being the interaction; here the switcher is.
//
// So the human is a HEADER, not a row: the monogram, the email on the display
// face as the page's h1, one meta line, and Sign out opposite. The `<h1>` that
// said "Account" went with the card — the rail's pill and the breadcrumb both
// say it already, and a page that names itself three times in 200px is not
// being clear, it is repeating.
//
// SIGN OUT IS A GHOST PILL, NOT THE DEFAULT. `SignOutButton`'s default class is
// `w-full … py-4`, sized for the sign-in column; dropped into a header slot it
// rendered a 56px pill — the single heaviest object on the page, for the one
// action nobody comes here to take. Pass the class. (Inverting the component's
// own default is its own issue; every other call site still wants full-width.)
//
// The `Organizations N` row went too: it was a right-aligned number whose only
// affordance was `hover:underline`, saying what the organization switcher says
// one line below it with a name attached.
import { redirect } from "next/navigation";
import { ScopeSwitchers } from "@/components/console/ScopeSwitchers";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

export const dynamic = "force-dynamic";

/** The one line under the email. A read failure says so — it never reads as
 *  "you have no organizations" (MESITA-1793's law). */
function accountMeta(count: number, failed: boolean): string {
  if (failed) return "Couldn't read your organizations";
  if (count === 0) return "No organization yet";
  return count === 1 ? "1 organization" : `${count} organizations`;
}

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  // getServerUser, not supabase.auth.getUser: the shell layout above already
  // validated this JWT over the network this request, and cache() hands back
  // that answer instead of asking again (MESITA-1729).
  const user = await getServerUser();
  if (!user) redirect("/signin?next=/account");

  let orgs: Awaited<ReturnType<typeof apiListOrganizations>> = [];
  let orgsError = false;
  try {
    orgs = await apiListOrganizations(supabase);
  } catch (e) {
    orgsError = true;
    console.error("[account] business-web-list-organizations:", e);
  }

  const email = user.email ?? "Your account";

  return (
    <>
      <div className="flex items-center gap-3.5">
        {/* The brand's own gradient, at the one size on this page big enough
            to carry it. aria-hidden: the h1 beside it is the name. */}
        <span
          aria-hidden
          className="bg-brand font-display flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold text-white"
        >
          {email.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          {/* The email IS the heading: it keeps the landmark the removed
              "Account" h1 held, and it is the one string on this page that
              says whose console this is. */}
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {email}
          </h1>
          <p className="text-muted-foreground mt-0.5 truncate text-[12px]">
            {accountMeta(orgs.length, orgsError)}
          </p>
        </div>
        <SignOutButton
          redirectTo="/signin"
          className={`${GHOST_PILL_BUTTON_CLASS} shrink-0`}
        />
      </div>

      <div className="border-border border-t" />

      {/* "Account must contain select account, organization selector, and
          place selector" (Pato, 2026-09-13; MESITA-1832). */}
      <ScopeSwitchers />
    </>
  );
}
