// Account — THE SIGNED-IN HUMAN, and nothing else (MESITA-1847).
//
// Pato, 2026-09-14: *"organization must be selected in organization not
// fucking there, account is just for there."* Both switchers lived here from
// MESITA-1832 on his own earlier instruction, and that was right while the
// Organization page did not exist. It existed, it was a rail row, and a
// selector belongs on the page about the thing it selects — so the
// organization switcher moved off this page and the place switcher was
// deleted outright.
//
// AND NOW THERE IS NOTHING LEFT TO SWITCH (MESITA-1892). The organization is
// gone; the one switcher the console still has is the rail's place selector,
// which renders only for an operator who holds two or more. What is left here
// is one row: who you are, and the way out. The card keeps its shape for the
// day a second row about the PERSON earns a place in it.
//
// THE ORGANIZATION COUNT WENT WITH THE LAYER. The line under the email read
// "1 organization" / "No organization yet", and it was the last thing in the
// console that named one. A place count would be the same mistake in new
// clothes: it is a fact about the business, and the rail is where the business
// is. So the row is the email and nothing under it.
//
// THE "YOU" CARD IS GONE (MESITA-1833). Pato, 2026-09-14: "make this prettier
// … far prettier". It held two rows of trivia — an email and a count — inside
// the page's only card, while the two switchers the page EXISTS for floated
// naked on the background at 40px tall. The weight was exactly backwards, and
// a card earns its border by being the interaction; here the switcher is.
//
// ONE BOX, ONE ROW (MESITA-1840, narrowed MESITA-1892). Pato, on the three
// boxes live: "merge." Three bordered boxes with gaps between them said the
// person, the organization and the place were unrelated, when they were one
// scope read top to bottom. Two of the three are gone and the survivor keeps
// the geometry (SCOPE_CARD_CLASS + SCOPE_ROW_CLASS), so the day a second row
// arrives it slots in rather than re-opening the argument.
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
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getServerUser } from "@/lib/supabase/server";
import {
  GHOST_PILL_BUTTON_CLASS,
  SCOPE_CARD_CLASS,
  SCOPE_CHIP_CLASS,
  SCOPE_ROW_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  // getServerUser, not supabase.auth.getUser: the shell layout above already
  // validated this JWT over the network this request, and cache() hands back
  // that answer instead of asking again (MESITA-1729).
  //
  // AND IT IS THE ONLY READ (MESITA-1892). The page used to list the caller's
  // organizations for one count line; with the count gone there is nothing
  // left to fetch, so the one page about the person costs no Edge Function
  // call at all.
  const user = await getServerUser();
  if (!user) redirect("/signin?next=/account");

  const email = user.email ?? "Your account";

  return (
    // ONE COLUMN, FULL WIDTH (MESITA-1836). A fragment, like every other
    // console page: the shell layout's `flex w-full flex-col gap-4` IS the
    // column, and the console is fluid by law (MESITA-1558).
    <div className={SCOPE_CARD_CLASS}>
      <div className={SCOPE_ROW_CLASS}>
        <span
          aria-hidden
          className={cn(
            SCOPE_CHIP_CLASS,
            "bg-brand font-display flex items-center justify-center text-lg font-semibold text-white",
          )}
        >
          {email.trim().charAt(0).toUpperCase()}
        </span>
        {/* A div, not a span: this row is a div, and an <h1> is not phrasing
            content — it may not sit inside one. The switcher rows use spans
            because their wrapper is a <button>, which may hold no heading at
            all. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={TINY_LABEL_CLASS}>You</span>
          {/* The email IS the heading: it keeps the landmark the removed
              "Account" h1 held, and it is the one string on this page that
              says whose console this is. */}
          {/* font-sans is LOAD-BEARING: globals.css puts every bare h1 on the
              display face, so without it the first of three peer titles
              renders in Fraunces and the other two in Inter — three rows at
              one rank, wearing two typefaces. */}
          <h1 className="mt-0.5 truncate font-sans text-base font-semibold tracking-tight">
            {email}
          </h1>
        </div>
        <SignOutButton
          redirectTo="/signin"
          className={`${GHOST_PILL_BUTTON_CLASS} shrink-0`}
        />
      </div>

    </div>
  );
}
