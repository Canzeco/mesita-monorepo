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
// THREE BIG BOXES, ONE RANK (MESITA-1837). Pato: "three big boxes." The
// console has exactly three nouns — the person, the organization, the place —
// and this is the one page that shows all three at once, so they share one
// shape (SCOPE_BOX_CLASS) and one weight. MESITA-1833 made the person a
// HEADER above the two switcher rows; that gave three different ranks to
// three things that are each one thing, and the header read as chrome sitting
// above the "real" content instead of as the first of three peers.
//
// The You box is a plain div, not a trigger: there is nothing to switch about
// who you are. It carries the `<h1>`. The `<h1>` that said "Account" is gone —
// the rail's pill and the breadcrumb both say it already, and a page that
// names itself three times in 200px is not being clear, it is repeating.
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
import {
  GHOST_PILL_BUTTON_CLASS,
  SCOPE_BOX_CLASS,
  SCOPE_CHIP_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

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
    // ONE COLUMN, FULL WIDTH (MESITA-1836). A fragment, like every other
    // console page: the shell layout's `flex w-full flex-col gap-4` IS the
    // column, and the console is fluid by law (MESITA-1558).
    <>
      <div className={SCOPE_BOX_CLASS}>
        <span
          aria-hidden
          className={cn(
            SCOPE_CHIP_CLASS,
            "bg-brand font-display flex items-center justify-center text-lg font-semibold text-white",
          )}
        >
          {email.trim().charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={TINY_LABEL_CLASS}>You</span>
          {/* The email IS the heading: it keeps the landmark the removed
              "Account" h1 held, and it is the one string on this page that
              says whose console this is. */}
          <h1 className="mt-0.5 truncate text-base font-semibold tracking-tight">
            {email}
          </h1>
          <span className="text-muted-foreground truncate text-[12px]">
            {accountMeta(orgs.length, orgsError)}
          </span>
        </span>
        <SignOutButton
          redirectTo="/signin"
          className={`${GHOST_PILL_BUTTON_CLASS} shrink-0`}
        />
      </div>

      {/* "Account must contain select account, organization selector, and
          place selector" (Pato, 2026-09-13; MESITA-1832). Boxes two and three. */}
      <ScopeSwitchers />
    </>
  );
}
