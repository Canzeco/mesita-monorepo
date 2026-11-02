"use client";

// The Business app's frame (MESITA-3103): a rail on desktop, a tab bar on the
// phone, both from NAV below. Profile, Premier and Settings open the current
// place's view of that name (the place in the URL, else the first place the
// caller runs). Payments, Prepayments and Rewards are Coming soon pages.
//
// Hiding a row is never the gate: every place door asks the server
// (business-web-* → place-access) and a stranger gets 404.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  CreditCard,
  Gift,
  LayoutGrid,
  Menu,
  Settings,
  ShieldCheck,
  Store,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { MesitaWordmark } from "@/components/brand/MesitaWordmark";
import { placeIdFromPathname, placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { cn } from "@/lib/utils";

export type ShellPlace = { id: string; name: string | null };

type Row = { key: string; label: string; icon: LucideIcon; href: string | null; soon?: boolean };

function rows(placeId: string | null, isSuperAdmin: boolean) {
  const place = (tab: PlaceTab) => (placeId ? placeTabHref(placeId, tab) : null);
  const main: Row[] = [
    { key: "profile", label: "Mesita Profile", icon: Store, href: place("profile") },
    { key: "premier", label: "Premier", icon: BadgeCheck, href: place("premier") },
    { key: "settings", label: "Settings", icon: Settings, href: place("settings") ?? "/settings" },
  ];
  const soon: Row[] = [
    { key: "payments", label: "Payments", icon: CreditCard, href: "/payments", soon: true },
    { key: "prepayments", label: "Prepayments", icon: Wallet, href: "/prepayments", soon: true },
    { key: "rewards", label: "Rewards", icon: Gift, href: "/rewards", soon: true },
  ];
  const more: Row[] = [
    { key: "places", label: "Your places", icon: LayoutGrid, href: "/places" },
    ...(isSuperAdmin ? [{ key: "internal", label: "Internal", icon: ShieldCheck, href: "/internal" }] : []),
  ];
  return { main, soon, more };
}

function isActive(pathname: string, row: Row): boolean {
  if (!row.href) return false;
  if (row.key === "profile" || row.key === "premier" || row.key === "settings") {
    return pathname.split("/")[3] === row.key || (row.key === "settings" && pathname === "/settings");
  }
  return pathname === row.href || pathname.startsWith(`${row.href}/`);
}

function RailRow({ row, pathname }: { row: Row; pathname: string }) {
  const active = isActive(pathname, row);
  const Icon = row.icon;
  const body = (
    <>
      <Icon className={cn("size-[1.125rem] shrink-0", active ? "text-foreground" : "text-muted-foreground")} aria-hidden />
      <span className="flex-1">{row.label}</span>
      {row.soon ? <span className="text-muted-foreground type-label">Soon</span> : null}
    </>
  );
  const cls = cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-[0.9375rem] transition-colors",
    active ? "bg-muted font-semibold text-foreground" : "text-foreground/80 hover:bg-muted/60",
  );
  if (!row.href) {
    return (
      <span className={cn(cls, "opacity-50")} aria-disabled title="Claim a place first">
        {body}
      </span>
    );
  }
  return (
    <Link href={row.href} aria-current={active ? "page" : undefined} className={cls}>
      {body}
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
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const urlPlace = placeIdFromPathname(pathname);
  const placeId = urlPlace ?? places[0]?.id ?? null;
  const current = places.find((p) => p.id === placeId) ?? null;
  const { main, soon, more } = rows(placeId, isSuperAdmin);

  return (
    <div className="min-h-dvh">
      <aside className="border-border bg-card fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r lg:flex">
        <Link href="/places" className="flex items-center gap-2 px-6 py-5">
          <MesitaMark className="size-7 text-(--brand-pink)" />
          <MesitaWordmark className="h-5 w-auto" />
          <span className="type-eyebrow text-muted-foreground ml-1">Business</span>
        </Link>
        {current?.name ? (
          <div className="mx-3 mb-3 truncate rounded-lg px-3 py-2 text-sm font-medium">{current.name}</div>
        ) : null}
        <nav aria-label="Business" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6">
          {main.map((r) => <RailRow key={r.key} row={r} pathname={pathname} />)}
          <div className="type-eyebrow text-muted-foreground px-3 pt-5 pb-2">Coming soon</div>
          {soon.map((r) => <RailRow key={r.key} row={r} pathname={pathname} />)}
          <div className="border-border mx-3 my-4 border-t" />
          {more.map((r) => <RailRow key={r.key} row={r} pathname={pathname} />)}
        </nav>
      </aside>

      <header className="border-border bg-card/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur lg:hidden">
        <MesitaMark className="size-6 shrink-0 text-(--brand-pink)" />
        <span className="min-w-0 truncate text-sm font-medium">{current?.name ?? "Mesita Business"}</span>
      </header>

      <div className="pb-20 lg:pb-0 lg:pl-64">
        <main className="mx-auto w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
      </div>

      <nav aria-label="Business" className="border-border bg-card/95 pb-safe fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:hidden">
        <div className="grid h-16 grid-cols-4">
          {main.map((r) => {
            const active = isActive(pathname, r);
            const Icon = r.icon;
            const label = r.key === "profile" ? "Profile" : r.label;
            if (!r.href) {
              return (
                <span key={r.key} className="text-muted-foreground flex flex-col items-center justify-center gap-1 text-xs font-medium opacity-50">
                  <Icon className="size-5" aria-hidden />
                  {label}
                </span>
              );
            }
            return (
              <Link
                key={r.key}
                href={r.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center justify-center gap-1 text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            );
          })}
          <Link
            href="/more"
            aria-current={pathname === "/more" ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-1 text-xs font-medium", pathname === "/more" ? "text-foreground" : "text-muted-foreground")}
          >
            <Menu className="size-5" aria-hidden />
            More
          </Link>
        </div>
      </nav>
    </div>
  );
}

/** The phone's More page: everything the tab bar has no room for. */
export function MoreList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const { soon, more } = rows(null, isSuperAdmin);
  return (
    <div className="flex flex-col gap-0.5">
      {more.map((r) => <RailRow key={r.key} row={r} pathname={pathname} />)}
      <div className="type-eyebrow text-muted-foreground px-3 pt-5 pb-2">Coming soon</div>
      {soon.map((r) => <RailRow key={r.key} row={r} pathname={pathname} />)}
    </div>
  );
}
