"use client";

// The Business app's frame (MESITA-3103; menu Pato, 2026-11-02, MESITA-3136):
//
//   Logo
//   Account   — the Google email, sign-out and What you pay (MESITA-3123)
//   Places    — the places you run, a page you open (/places)
//   ──
//   <place>   — its photo, name and Owner/Editor/Mesita staff; opens Profile
//     Profile · Reviews · Premier · Future   the products
//     Settings                              the place's, Billing inside
//
//     Admin   — Mesita staff only (MESITA-3122), set apart
//
// The place's pages hang under it. Colour tells the groups apart (Pato:
// "group with colors for better understanding"): you in blue, the products
// in red, Settings and Admin in grey. There is no tab row on the page: the
// menu is the only navigation ("don't make the horizontal menu, it's
// redundant"); Preview is a button on Profile.
//
// The current place is the one in the URL, else the first you run; without
// one nothing sits below the line, Admin included (MESITA-3126). Its name
// comes from the place layout (`ShellPlaceName`), so staff see the real
// name of any place they open. Desktop web (MESITA-3119): the side menu is
// the only menu at every width, narrowing to icons below lg.
//
// Hiding a row is never the gate: every place door asks the server
// (business-web-* → place-access) and a stranger gets 404.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, CircleUser, IdCard, MapPin, Settings, ShieldCheck, Sparkles, Star, Store, type LucideIcon } from "lucide-react";
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

type Row = { key: string; label: string; icon: LucideIcon; tone: Tone; href: string; active: boolean };

type PlaceMenu = {
  header: { href: string; active: boolean; name: string; photo: string | null; role: string | null };
  rows: Row[];
  admin: Row | null;
};

function menu(
  pathname: string,
  placeId: string | null,
  place: { name: string | null; photo: string | null; role: ShellPlace["role"] } | null,
  isSuperAdmin: boolean,
): { you: Row[]; place: PlaceMenu | null } {
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const you: Row[] = [
    { key: "account", label: "Account", icon: CircleUser, tone: "you", href: "/account", active: pathname === "/account" },
    { key: "places", label: "Places", icon: Store, tone: "you", href: "/places", active: pathname === "/places" || pathname.startsWith("/claim") },
  ];
  if (!placeId) return { you, place: null };

  const tab = (key: PlaceTab, label: string, icon: LucideIcon, tone: Tone): Row => {
    const href = placeTabHref(placeId, key);
    return { key, label, icon, tone, href, active: under(href) };
  };
  const role = place?.role === "owner" ? "Owner" : place?.role === "editor" ? "Editor" : isSuperAdmin ? "Mesita staff" : null;
  return {
    you,
    place: {
      header: { href: placeTabHref(placeId, "profile"), active: false, name: place?.name || "Place", photo: place?.photo ?? null, role },
      rows: [
        tab("profile", "Profile", IdCard, "product"),
        tab("reviews", "Reviews", Star, "product"),
        tab("premier", "Premier", BadgeCheck, "product"),
        tab("future", "Future", Sparkles, "product"),
        tab("settings", "Settings", Settings, "system"),
      ],
      // Mesita staff only (MESITA-3122): the place's staff page. The server
      // refuses anyone else.
      admin: isSuperAdmin ? tab("internal", "Admin", ShieldCheck, "system") : null,
    },
  };
}

/** The place's header (MESITA-3128, 3136): photo, name and your role; it
 *  opens Profile. */
function PlaceHeader({ header }: { header: PlaceMenu["header"] }) {
  return (
    <Link
      href={header.href}
      title={header.name}
      aria-label={`${header.name}, profile`}
      className="hover:bg-muted/60 flex items-center justify-center gap-2.5 rounded-lg p-1.5 transition-colors lg:justify-start lg:px-2.5 lg:py-2"
    >
      {header.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={header.photo} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
          <MapPin className="text-muted-foreground size-4" aria-hidden />
        </span>
      )}
      <span className="hidden min-w-0 flex-col lg:flex">
        <span className="truncate text-sm font-semibold">{header.name}</span>
        {header.role ? <span className="text-muted-foreground truncate text-xs">{header.role}</span> : null}
      </span>
    </Link>
  );
}

const Line = () => <div role="separator" className="border-border my-2 border-t" />;

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
        row.active ? "bg-muted text-foreground font-semibold" : "text-foreground/75 hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", TONE[row.tone])}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="hidden truncate lg:inline">{row.label}</span>
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
  const { you, place } = menu(pathname, placeId, current, isSuperAdmin);

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
          {you.map((r) => <RailRow key={r.key} row={r} />)}
          {place ? (
            <>
              <Line />
              <PlaceHeader header={place.header} />
              {/* The place's pages hang under it: an indent and a guide line at lg. */}
              <div className="flex flex-col gap-0.5 lg:border-border lg:mt-0.5 lg:ml-[1.4rem] lg:border-l lg:pl-2">
                {place.rows.map((r) => <RailRow key={r.key} row={r} />)}
                {place.admin ? (
                  <div className="mt-3">
                    <RailRow row={place.admin} />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </nav>
      </aside>

      <div className="pl-16 lg:pl-60">
        <main className="mx-auto w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
