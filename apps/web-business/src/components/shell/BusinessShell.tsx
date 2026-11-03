"use client";

// The Business app's frame (MESITA-3103; menu Pato, 2026-11-02, MESITA-3136):
//
//   Logo
//   <place> ⌄ — Places: the current place by photo and name; opens /places
//               to switch, claim or (staff) open any place
//   ┌ Products ──────────────────────────────────────────────┐
//   │ Profile · Reviews · Premier · Payments Soon · Rewards Soon │
//   └────────────────────────────────────────────────────────┘
//   ┌ Manage ─────────────────────────────────┐
//   │ Settings (Billing inside) · Admin (staff) │  Admin: MESITA-3122
//   └─────────────────────────────────────────┘
//   …
//   Account   — at the foot: email, sign-out, What you pay
//
// The place's pages sit in two labelled boxes (Pato: "if you use boxes it's
// clearer to understand"), and colour tells the groups apart ("group with
// colors for better understanding"): you in blue, the products in red,
// Manage in grey. There is no tab row on the page: the menu is the only
// navigation ("don't make the horizontal menu, it's redundant"); Preview is
// a button on Profile.
//
// The current place is the one in the URL, else the first you run; without
// one the Places row says Places and nothing sits under it, Admin included
// (MESITA-3126). Its name comes from the place layout (`ShellPlaceName`), so
// staff see the real name of any place they open. Desktop web (MESITA-3119):
// the side menu is the only menu at every width, narrowing to icons below lg.
//
// Hiding a row is never the gate: every place door asks the server
// (business-web-* → place-access) and a stranger gets 404.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, ChevronsUpDown, CircleUser, CreditCard, Gift, IdCard, Settings, ShieldCheck, Star, Store, type LucideIcon } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { placeIdFromPathname, placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { useShellPlace } from "@/lib/shell-place";
import { cn } from "@/lib/utils";

export type ShellPlace = { id: string; name: string | null; photo: string | null; role: "owner" | "editor" | null };

/** A group's colour: the icon sits in a small tinted box. */
type Tone = "you" | "product" | "system";

const TONE: Record<Tone, string> = {
  you: "bg-blue-500/10 text-blue-600",
  product: "bg-red-500/10 text-red-600",
  system: "bg-muted text-muted-foreground",
};

type Row = { key: string; label: string; icon: LucideIcon; tone: Tone; href: string; active: boolean; soon?: boolean };

/** The Places row: the current place, or plain Places without one. */
type Switcher = { href: string; active: boolean; name: string; photo: string | null; role: string | null; hasPlace: boolean };

type PlaceMenu = { products: Row[]; manage: Row[] };

function menu(
  pathname: string,
  placeId: string | null,
  place: { name: string | null; photo: string | null; role: ShellPlace["role"] } | null,
  isSuperAdmin: boolean,
): { account: Row; switcher: Switcher; place: PlaceMenu | null } {
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const account: Row = { key: "account", label: "Account", icon: CircleUser, tone: "you", href: "/account", active: pathname === "/account" };
  const role = place?.role === "owner" ? "Owner" : place?.role === "editor" ? "Editor" : isSuperAdmin ? "Mesita staff" : null;
  const switcher: Switcher = {
    href: "/places",
    active: pathname === "/places" || pathname.startsWith("/claim"),
    name: placeId ? place?.name || "Place" : "Places",
    photo: placeId ? (place?.photo ?? null) : null,
    role: placeId ? role : null,
    hasPlace: !!placeId,
  };
  if (!placeId) return { account, switcher, place: null };

  const tab = (key: PlaceTab, label: string, icon: LucideIcon, tone: Tone, soon = false): Row => {
    const href = placeTabHref(placeId, key);
    return { key, label, icon, tone, href, active: under(href), soon };
  };
  return {
    account,
    switcher,
    place: {
      products: [
        tab("profile", "Profile", IdCard, "product"),
        tab("reviews", "Reviews", Star, "product"),
        tab("premier", "Premier", BadgeCheck, "product"),
        tab("payments", "Payments", CreditCard, "product", true),
        tab("rewards", "Rewards", Gift, "product", true),
      ],
      manage: [
        tab("settings", "Settings", Settings, "system"),
        // Mesita staff only (MESITA-3122): the place's staff page. The server
        // refuses anyone else.
        ...(isSuperAdmin ? [tab("internal", "Admin", ShieldCheck, "system")] : []),
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
        "flex items-center justify-center gap-2.5 rounded-xl p-1.5 transition-colors lg:justify-start lg:px-2 lg:py-2",
        s.active ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      {s.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.photo} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE.you)}>
          <Store className="size-4" aria-hidden />
        </span>
      )}
      <span className="hidden min-w-0 flex-1 flex-col lg:flex">
        <span className="truncate text-sm font-semibold">{s.name}</span>
        <span className="text-muted-foreground truncate text-xs">{s.role ?? (s.hasPlace ? "Places" : "Your places")}</span>
      </span>
      <ChevronsUpDown className="text-muted-foreground hidden size-4 shrink-0 lg:block" aria-hidden />
    </Link>
  );
}

/** A labelled box of rows; below lg only the rows' icons show. */
function Group({ label, rows }: { label: string; rows: Row[] }) {
  return (
    <div role="group" aria-label={label} className="border-border bg-muted/40 mt-2 flex flex-col gap-0.5 rounded-xl border p-1">
      <p className="type-label text-muted-foreground hidden px-1.5 pt-1 pb-0.5 font-semibold tracking-[0.12em] uppercase lg:block">{label}</p>
      {rows.map((r) => <RailRow key={r.key} row={r} />)}
    </div>
  );
}

function RailRow({ row }: { row: Row }) {
  const Icon = row.icon;
  return (
    <Link
      href={row.href}
      title={row.label}
      aria-label={row.label}
      aria-current={row.active ? "page" : undefined}
      // Below lg the rail is icons only (w-16); the label returns at lg.
      className={cn(
        "flex h-10 items-center justify-center gap-2.5 rounded-lg px-1.5 text-sm transition-colors lg:h-9 lg:justify-start",
        row.active ? "bg-card text-foreground font-semibold shadow-sm" : "text-foreground/75 hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", TONE[row.tone])}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="hidden min-w-0 flex-1 truncate lg:inline">{row.label}</span>
      {row.soon ? <span className="type-label bg-muted text-muted-foreground hidden shrink-0 rounded-full px-2 py-0.5 font-semibold lg:inline">Soon</span> : null}
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
  const named = useShellPlace();
  const placeId = placeIdFromPathname(pathname) ?? places[0]?.id ?? null;
  const mine = places.find((p) => p.id === placeId) ?? null;
  const shown = named?.id === placeId ? named : null;
  const current = mine || shown ? { name: shown?.name ?? mine?.name ?? null, photo: shown?.photo ?? mine?.photo ?? null, role: mine?.role ?? null } : null;
  const { account, switcher, place } = menu(pathname, placeId, current, isSuperAdmin);

  // Desktop web (Pato, 2026-11-02, MESITA-3119): one side menu at every
  // width, no bottom bar; below lg it narrows to an icon rail.
  return (
    <div className="min-h-dvh">
      <aside className="border-border bg-card fixed inset-y-0 left-0 z-30 flex w-16 flex-col border-r px-2 pt-5 pb-3 lg:w-60 lg:px-3">
        <Link href="/places" title="Mesita Business" className="flex items-center justify-center gap-2 lg:justify-start lg:px-2.5">
          <MesitaMark className="size-6 shrink-0 text-(--brand-pink)" />
          <span className="hidden text-base font-semibold tracking-tight lg:inline">Business</span>
        </Link>
        <nav aria-label="Business" className="mt-6 flex flex-1 flex-col gap-0.5">
          <PlaceSwitcher s={switcher} />
          {place ? (
            <>
              <Group label="Products" rows={place.products} />
              <Group label="Manage" rows={place.manage} />
            </>
          ) : null}
          {/* Account sits at the foot (Pato, MESITA-3136). */}
          <div className="border-border mt-auto border-t pt-2">
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
