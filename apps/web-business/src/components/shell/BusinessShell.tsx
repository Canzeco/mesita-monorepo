"use client";

// The Business app's frame (MESITA-3103; menu Pato, 2026-11-02, MESITA-3136):
//
//   Mesita    — on top: the word, as the consumer app draws it (MESITA-3153)
//   Place
//   <place> ⌄ — Places: the current place by photo and name; opens /places
//               to switch, claim or (staff) open any place
//   ┌ Operations (MESITA-3202) ────────────────────┐
//   │ Views · Visits · Money                       │  MESITA-3301/3308; the pages
//   └──────────────────────────────────────────────┘  stand before payments
//   ┌ Capabilities (MESITA-3152; was Products) ────┐
//   │ Profile · Premier · Payments · Reservations · All │  All: MESITA-3238,
//   └───────────────────────────────────────────────────┘  every product
//   ┌ Manage ─────────────────────────────────┐
//   │ Settings · Admin (staff)               │  Admin: MESITA-3122
//   └─────────────────────────────────────────┘
//   …
//   Account   — at the foot: email, sign-out, What you pay
//
// The place's pages sit in two labelled groups (Pato: "if you use boxes it's
// clearer to understand"). No colour (Pato, MESITA-3148, reversing
// MESITA-3144: "red and blue look bad… minimalist… think Apple"): grey
// labels, monochrome icons, the open page a soft grey pill. There is no tab row on the page: the menu is the only
// navigation ("don't make the horizontal menu, it's redundant"); Preview is
// a button on Profile.
//
// The current place is the one in the URL, else the last place you opened
// this visit, else the first you run. The menu is never empty (Pato,
// MESITA-3137, reversing MESITA-3126): with no place at all both boxes still
// show, every row greyed until you choose one. Its name comes from the place
// layout (`ShellPlaceName`), so
// staff see the real name of any place they open. Desktop web (MESITA-3119):
// the side menu is the only menu at every width, narrowing to icons below lg.
//
// Hiding a row is never the gate: every place door asks the server
// (business-web-* → place-access) and a stranger gets 404.

import Link from "next/link";
import { Outfit } from "next/font/google";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { StorefrontIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { PLACE_TAB_META } from "./place-tab-meta";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { ACCOUNT, PLACES, placeIdFromPathname, placeTabHref, type PlaceTab } from "@/lib/routes";
import { needsStripeConnect, useTrustedShellPlace } from "@/lib/shell-place";
import { cn } from "@/lib/utils";

// The consumer app's wordmark face (web-consumer ModeTabs).
const wordmarkFont = Outfit({ subsets: ["latin"], weight: "700" });

export type ShellPlace = { id: string; name: string | null; photo: string | null; role: "owner" | "editor" | null };

/** `href` null: there is no place yet, so the row is drawn greyed, not a link. */
type Row = { key: string; label: string; icon: Icon; href: string | null; active: boolean; dot?: string };

/** The Places row: the current place, or plain Places without one. */
type Switcher = { href: string; active: boolean; name: string; photo: string | null; role: string | null; hasPlace: boolean };

type PlaceMenu = { operations: Row[]; products: Row[]; manage: Row[] };

function menu(
  pathname: string,
  placeId: string | null,
  place: { name: string | null; photo: string | null; role: ShellPlace["role"] } | null,
  isSuperAdmin: boolean,
  connectStripe: boolean,
): { account: Row; switcher: Switcher; place: PlaceMenu } {
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const account: Row = { key: "account", label: "Account", icon: UserCircleIcon, href: ACCOUNT, active: pathname === ACCOUNT };
  const role = place?.role === "owner" ? "Owner" : place?.role === "editor" ? "Editor" : isSuperAdmin ? "Mesita staff" : null;
  const switcher: Switcher = {
    href: PLACES,
    active: pathname === PLACES || pathname.startsWith("/claim/"),
    name: placeId ? place?.name || "Place" : "Choose a place",
    photo: placeId ? (place?.photo ?? null) : null,
    role: placeId ? role : null,
    hasPlace: !!placeId,
  };
  const tab = (key: PlaceTab): Row => {
    const { label, icon } = PLACE_TAB_META[key];
    const href = placeId ? placeTabHref(placeId, key) : null;
    return { key, label, icon, href, active: href ? under(href) : false };
  };
  return {
    account,
    switcher,
    place: {
      operations: [tab("views"), tab("visits"), tab("money")],
      products: [
        // Reviews lives inside Profile (MESITA-3393).
        tab("profile"),
        tab("premier"),
        // One quiet dot until the place's Stripe account can charge
        // (MESITA-3384); Payments leads with the Connect card meanwhile.
        { ...tab("payments"), ...(connectStripe ? { dot: "Connect Stripe" } : {}) },
        // Its one On/Off switch (MESITA-3600; was Settings › Actions).
        tab("reservations"),
        // Last: every product, current and future (MESITA-3238).
        tab("all"),
      ],
      manage: [
        // Billing folded into Premier (MESITA-3620).
        tab("settings"),
        // Mesita staff only (MESITA-3122): the place's staff page. The server
        // refuses anyone else.
        ...(isSuperAdmin ? [tab("admin")] : []),
      ],
    },
  };
}

/** Places (Pato, MESITA-3136: "Places (Place)"): the current place by photo,
 *  name and your role; it opens /places to switch, claim or open another. */
function PlaceSwitcher({ s }: { s: Switcher }) {
  return (
    <Link
      href={s.href}
      title={s.hasPlace ? `${s.name}: switch place` : "Places"}
      aria-label={s.hasPlace ? `${s.name}, switch place` : "Places"}
      aria-current={s.active ? "page" : undefined}
      className={cn(
        "border-border flex h-12 items-center justify-center gap-3 rounded-lg border px-1.5 shadow-xs transition-colors lg:justify-start lg:px-2.5",
        s.active ? "bg-muted" : "bg-card hover:bg-muted/60",
      )}
    >
      {s.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.photo} alt="" className="size-7 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
          <StorefrontIcon size={20} aria-hidden />
        </span>
      )}
      <span className="hidden min-w-0 flex-1 flex-col lg:flex">
        <span className="truncate text-sm leading-tight font-semibold">{s.name}</span>
        <span className="text-muted-foreground truncate text-xs leading-tight">{s.role ?? "Places"}</span>
      </span>
    </Link>
  );
}

/** A group's title; one style for Place, Operations, Capabilities and Manage. */
function GroupLabel({ label }: { label: string }) {
  return <p className="text-muted-foreground hidden h-7 items-center px-3 text-xs font-semibold lg:flex">{label}</p>;
}

/** A labelled group of rows; below lg only the rows' icons show. */
function Group({ label, rows }: { label: string; rows: Row[] }) {
  return (
    <div role="group" aria-label={label} className="mt-5 flex flex-col gap-0.5">
      <GroupLabel label={label} />
      {rows.map((r) => <RailRow key={r.key} row={r} />)}
    </div>
  );
}

/** Every menu row is one size (Pato, MESITA-3153: "standardized on
 *  sizes"): 40px tall, the same inset as the labels and the switcher, a
 *  20px icon slot. */
const ROW = "flex h-10 items-center justify-center gap-3 rounded-lg px-1.5 text-sm transition-colors lg:justify-start lg:px-3";

function RailRow({ row }: { row: Row }) {
  const RowIcon = row.icon;
  const inner = (
    <>
      <span className="flex w-5 shrink-0 justify-center">
        {/* Solid on the open page (Pato, MESITA-3235). */}
        <RowIcon size={20} weight={row.active ? "fill" : "regular"} aria-hidden />
      </span>
      <span className="hidden min-w-0 flex-1 truncate lg:inline">{row.label}</span>
      {row.dot ? (
        <span className="bg-muted-foreground/60 absolute top-2 right-2 size-1.5 rounded-full lg:static lg:shrink-0" aria-hidden />
      ) : null}
    </>
  );
  if (!row.href) {
    return (
      <span
        aria-disabled
        title={`${row.label}: choose a place first`}
        className={cn(ROW, "text-foreground cursor-default opacity-40")}
      >
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={row.href}
      title={row.dot ? `${row.label}: ${row.dot}` : row.label}
      aria-label={row.dot ? `${row.label}: ${row.dot}` : row.label}
      aria-current={row.active ? "page" : undefined}
      // Below lg the rail is icons only (w-16); the label returns at lg.
      className={cn(
        ROW,
        row.dot && "relative",
        row.active ? "bg-muted text-foreground font-medium" : "text-foreground/80 hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {inner}
    </Link>
  );
}

export function BusinessShell({
  places,
  isSuperAdmin,
  children,
}: {
  places: ShellPlace[];
  isSuperAdmin: boolean;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // A remembered pick (MESITA-3152) counts only while you still run it, or,
  // for Mesita staff, who open any place, once the server confirms it still
  // opens (MESITA-3590: after a Reset it named a deleted place).
  const named = useTrustedShellPlace(isSuperAdmin, places.map((p) => p.id));
  // The URL's place, else the last one opened this visit, else the first you run.
  const placeId = placeIdFromPathname(pathname) ?? named?.id ?? places[0]?.id ?? null;
  const mine = places.find((p) => p.id === placeId) ?? null;
  const shown = named?.id === placeId ? named : null;
  const current = mine || shown ? { name: shown?.name ?? mine?.name ?? null, photo: shown?.photo ?? mine?.photo ?? null, role: mine?.role ?? null } : null;
  const { account, switcher, place } = menu(pathname, placeId, current, isSuperAdmin, needsStripeConnect(placeId));

  // Desktop web (Pato, 2026-11-02, MESITA-3119): one side menu at every
  // width, no bottom bar; below lg it narrows to an icon rail.
  return (
    <div className="min-h-dvh">
      {/* Dark for Mesita staff only (Pato, MESITA-3297); owners and editors
          keep the light rail (MESITA-3116). `.staff-rail` swaps the tokens, so
          every row below is drawn the same way in both. */}
      <aside
        className={cn(
          "border-border bg-card text-foreground fixed inset-y-0 left-0 z-30 flex w-16 flex-col border-r px-2 pt-5 pb-3 lg:w-60 lg:px-3",
          isSuperAdmin && "staff-rail",
        )}
      >
        {/* The name on top (Pato, MESITA-3153, reversing MESITA-3151: "just
            say Mesita like in the consumer app"): the word "Mesita" in
            Outfit, as the consumer app's header draws it; the bare mark
            below lg. */}
        <Link href={PLACES} title="Mesita" className="mb-5 flex h-10 shrink-0 items-center justify-center lg:justify-start lg:px-3">
          <MesitaMark className="size-6 shrink-0 text-(--brand-pink) lg:hidden" />
          <span className={cn(wordmarkFont.className, "text-foreground hidden text-2xl leading-none tracking-[-0.03em] select-none lg:inline")}>
            Mesita
          </span>
        </Link>
        <nav aria-label="Business" className="flex min-h-0 flex-1 flex-col">
          {/* Only the groups scroll, so a short window still reaches every row
              and Account stays put (MESITA-3263). `-mx-1 px-1` keeps focus
              outlines and the switcher's shadow from clipping at the edge. */}
          <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-1 py-0.5">
            {/* "Place" over the switcher, as Capabilities and Manage over
                theirs (Pato, MESITA-3156: "just to keep symmetry"). */}
            <div role="group" aria-label="Place" className="flex flex-col gap-0.5">
              <GroupLabel label="Place" />
              <PlaceSwitcher s={switcher} />
            </div>
            <Group label="Operations" rows={place.operations} />
            <Group label="Capabilities" rows={place.products} />
            <Group label="Manage" rows={place.manage} />
          </div>
          {/* Account sits at the foot (Pato, MESITA-3136). */}
          <div className="border-border mt-2 shrink-0 border-t pt-2">
            <RailRow row={account} />
          </div>
        </nav>
      </aside>

      <div className="pl-16 lg:pl-60">
        <main className="mx-auto w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
