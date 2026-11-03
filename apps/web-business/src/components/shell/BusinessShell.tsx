"use client";

// The Business app's frame (MESITA-3103; menu Pato, 2026-11-02, MESITA-3128):
//
//   Logo
//   Account   — the Google email and sign-out (MESITA-3123)
//   Places    — the places you run, a page you open (/places)
//   ──
//   <place>   — a small header: photo, name, Owner/Editor; opens its Preview
//   ──
//   Profile · Reviews · Premier · Future (the products still coming)
//   ──
//   Billing   — the Premier card and every charge
//   Settings
//   Admin     — Mesita staff only (MESITA-3122)
//
// Above the first line is you, below it one place. The current place is the
// one in the URL, else the first you run; without one nothing sits below the
// line, Admin included (MESITA-3126). Desktop web (MESITA-3119): the side menu
// is the only menu at every width, narrowing to icons below lg.
//
// Hiding a row is never the gate: every place door asks the server
// (business-web-* → place-access) and a stranger gets 404.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, CircleUser, CreditCard, IdCard, MapPin, Settings, ShieldCheck, Sparkles, Star, Store, type LucideIcon } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { placeIdFromPathname, placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { cn } from "@/lib/utils";

export type ShellPlace = { id: string; name: string | null; photo: string | null; role: "owner" | "editor" | null };

type Row = { key: string; label: string; icon: LucideIcon; href: string | null; active: boolean; photo?: string | null };

type PlaceMenu = { header: Row & { role: string | null }; groups: Row[][] };

function menu(
  pathname: string,
  placeId: string | null,
  place: ShellPlace | null,
  isSuperAdmin: boolean,
): { you: Row[]; place: PlaceMenu | null } {
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const you: Row[] = [
    { key: "account", label: "Account", icon: CircleUser, href: "/account", active: pathname === "/account" },
    { key: "places", label: "Places", icon: Store, href: "/places", active: pathname === "/places" || pathname.startsWith("/claim") },
  ];
  if (!placeId) return { you, place: null };

  const tab = (key: PlaceTab, label: string, icon: LucideIcon): Row => {
    const href = placeTabHref(placeId, key);
    return { key, label, icon, href, active: under(href) };
  };
  const role = place?.role === "owner" ? "Owner" : place?.role === "editor" ? "Editor" : isSuperAdmin ? "Mesita staff" : null;
  return {
    you,
    place: {
      header: { ...tab("preview", place?.name || "Place", MapPin), photo: place?.photo, role },
      groups: [
        [tab("profile", "Profile", IdCard), tab("reviews", "Reviews", Star), tab("premier", "Premier", BadgeCheck), tab("future", "Future", Sparkles)],
        [
          tab("billing", "Billing", CreditCard),
          tab("settings", "Settings", Settings),
          // Mesita staff only (MESITA-3122): the place's staff page. The
          // server refuses anyone else.
          ...(isSuperAdmin ? [tab("internal", "Admin", ShieldCheck)] : []),
        ],
      ],
    },
  };
}

/** The place's header row (Pato, MESITA-3128: "a quick header mentioning the
 *  place name"): photo, name and your role; it opens the place's Preview. */
function PlaceHeader({ row }: { row: PlaceMenu["header"] }) {
  return (
    <Link
      href={row.href ?? "#"}
      title={row.label}
      aria-label={`${row.label}, preview`}
      aria-current={row.active ? "page" : undefined}
      className={cn(
        "flex items-center justify-center gap-2.5 rounded-lg p-1.5 transition-colors lg:justify-start lg:px-2.5 lg:py-2",
        row.active ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      {row.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.photo} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
          <MapPin className="text-muted-foreground size-4" aria-hidden />
        </span>
      )}
      <span className="hidden min-w-0 flex-col lg:flex">
        <span className="truncate text-sm font-semibold">{row.label}</span>
        {row.role ? <span className="text-muted-foreground truncate text-xs">{row.role}</span> : null}
      </span>
    </Link>
  );
}

const Line = () => <div role="separator" className="border-border my-2 border-t" />;

function RailRow({ row }: { row: Row }) {
  const Icon = row.icon;
  const photo = row.photo;
  // Below lg the rail is icons only (w-16); the label returns at lg.
  const base = "flex h-10 items-center justify-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors lg:h-9 lg:justify-start";
  const glyph = photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" className={cn("size-5 shrink-0 rounded-full object-cover", row.active && "ring-foreground ring-2")} />
  ) : (
    <Icon className={cn("size-4 shrink-0", row.active ? "text-foreground" : "text-muted-foreground")} aria-hidden />
  );
  const label = <span className="hidden truncate lg:inline">{row.label}</span>;
  if (!row.href) {
    return (
      <span aria-disabled title={`${row.label}: choose a place first`} className={cn(base, "text-muted-foreground/50 opacity-60")}>
        {glyph}
        {label}
      </span>
    );
  }
  return (
    <Link
      href={row.href}
      title={row.label}
      aria-label={row.label}
      aria-current={row.active ? "page" : undefined}
      className={cn(base, row.active ? "bg-muted text-foreground font-semibold" : "text-foreground/75 hover:bg-muted/60 hover:text-foreground")}
    >
      {glyph}
      {label}
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
  const placeId = placeIdFromPathname(pathname) ?? places[0]?.id ?? null;
  const current = places.find((p) => p.id === placeId) ?? null;
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
              <PlaceHeader row={place.header} />
              {place.groups.map((g, i) => (
                <div key={i} className="contents">
                  <Line />
                  {g.map((r) => <RailRow key={r.key} row={r} />)}
                </div>
              ))}
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
