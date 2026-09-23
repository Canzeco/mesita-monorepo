// SETTINGS — the fourth tab: you, and the place you have open (MESITA-1974).
//
// IT IS NOT PLACE-SCOPED ANY MORE, and that is load-bearing rather than tidy.
// Sign out lives here now that `/account` is gone, and `Sidebar` draws
// `RAIL_ROWS` only in the `solo` and `multi` shapes — so an address of the
// form `/places/<id>/settings` would put the console's only exit behind a
// successful places read. `/settings` resolves with no place at all.
//
// IT IS A REAL PAGE, NOT A FLAT TWIN. The name left `FLAT_ROUTES` in the same
// commit this file took the static segment, because a static segment shadows
// `[flat]` in Next's router — a contract name a real route shadows is the
// MESITA-1839 trap from the other side, and the old `/places/<id>/settings`
// owes a permanent rule in `next.config.ts` for the same reason.
//
// TWO SCOPES, TOP TO BOTTOM: the PERSON, then the PLACE. MESITA-1937 kept them
// as two destinations on the argument that scope is the divider; Pato's four
// tabs put them on one screen — *"Settings, Account also here"* — and the
// split survives as the two sections.
//
// THE PERSON COSTS NO READ. `getServerUser` is the shell layout's own
// request-cached answer (MESITA-1729), so the top of this page is free.
//
// THE PLACE HALF READS NOTHING EITHER: `SettingsBody` takes its team from
// `PlaceContext`, which the shell published. With no place open it renders
// nothing and the page is the person alone, which is the honest shape for
// somebody who holds none.
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DevelopersSoonFallback } from "./DevelopersSoonFallback";
import { getServerUser } from "@/lib/supabase/server";
import {
  GHOST_PILL_BUTTON_CLASS,
  SCOPE_CARD_CLASS,
  SCOPE_CHIP_CLASS,
  SCOPE_ROW_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { SettingsBody } from "./SettingsBody";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getServerUser();
  if (!user) redirect("/signin?next=/settings");

  const email = user.email ?? "Your account";

  return (
    <>
      {/* ONE BOX, ONE ROW (MESITA-1840). The card keeps its geometry for the
          day a second row about the PERSON earns a place in it. */}
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
          {/* A div, not a span: an <h1> is not phrasing content and may not
              sit inside one. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className={TINY_LABEL_CLASS}>You</span>
            {/* The email IS the heading: it is the one string on this page
                that says whose console this is.

                `font-sans` is LOAD-BEARING: globals.css puts every bare h1 on
                the display face, so without it this title renders in Fraunces
                while the section titles under it render in Inter. */}
            <h1 className="mt-0.5 truncate font-sans text-base font-semibold tracking-tight">
              {email}
            </h1>
          </div>
          {/* `SignOutButton`'s default class is `w-full … py-4`, sized for the
              sign-in column; dropped into a row it renders a 56px pill — the
              heaviest object on the page, for the one action nobody comes here
              to take. Pass the class. */}
          <SignOutButton
            redirectTo="/signin"
            className={`${GHOST_PILL_BUTTON_CLASS} shrink-0`}
          />
        </div>
      </div>

      {/* THE PLACE: who may touch it, and how an agent drives it. */}
      <SettingsBody />
      {/* No place open — honest Soon until a venue is selected (MESITA-1912). */}
      <DevelopersSoonFallback />
    </>
  );
}
