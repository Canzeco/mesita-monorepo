"use client";

// The Business app's frame (MESITA-3103, menu MESITA-3111).
//
// Desktop rail (Pato, 2026-11-02, MESITA-3112/3114/3116): light, compact
//   rows, small grey group labels, never rules. Top to bottom: the pink mark
//   + "Business", the place switcher (the place in the URL, else your first
//   place; staff also find Internal in it), PLACE (Profile · Premier),
//   MESITA (Settings · Products), the account.
// Phone: a tab bar (Profile · Premier · Settings · More); More holds the
//   selector's list, Products and the account. Payments, Prepayments and
//   Rewards are rows on Products (their old pages redirect there).
//
// Hiding a row is never the gate: every place door asks the server
// (business-web-* → place-access) and a stranger gets 404.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Check,
  ChevronsUpDown,
  LayoutGrid,
  Package,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Store,
  type LucideIcon,
} from "lucide-react";
import { authSignOut } from "@/app/auth/actions";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { placeIdFromPathname, placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { cn } from "@/lib/utils";

export type ShellPlace = { id: string; name: string | null; photo: string | null };

type Row = { key: string; label: string; icon: LucideIcon; href: string | null };

/** The rail (Pato, 2026-11-02, MESITA-3114): the place selector, then
 *  Profile · Premier, then Settings · Products. Profile, Premier and
 *  Settings are the place's ("settings is for the place, not the account")
 *  and wait without one; Products is Mesita's list of place products. */
function placeRows(placeId: string | null): Row[] {
  const href = (tab: PlaceTab) => (placeId ? placeTabHref(placeId, tab) : null);
  return [
    { key: "profile", label: "Profile", icon: Store, href: href("profile") },
    { key: "premier", label: "Premier", icon: BadgeCheck, href: href("premier") },
  ];
}

function moreRows(placeId: string | null): Row[] {
  return [
    { key: "settings", label: "Settings", icon: Settings, href: placeId ? placeTabHref(placeId, "settings") : null },
    { key: "products", label: "Products", icon: Package, href: "/products" },
  ];
}

function isActive(pathname: string, row: Row): boolean {
  if (!row.href) return false;
  return pathname === row.href || pathname.startsWith(`${row.href}/`);
}

function PlacePhoto({ place, className }: { place: ShellPlace | null; className?: string }) {
  if (place?.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={place.photo} alt="" className={cn("shrink-0 rounded-lg object-cover", className)} />;
  }
  return (
    <span className={cn("bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-lg", className)}>
      <Store className="size-4" aria-hidden />
    </span>
  );
}

function NavRow({ row, pathname }: { row: Row; pathname: string }) {
  const active = isActive(pathname, row);
  const Icon = row.icon;
  if (!row.href) {
    return (
      <span aria-disabled title="Choose a place first" className="text-muted-foreground flex min-h-10 items-center gap-3 rounded-lg px-3 text-[0.9375rem] opacity-50">
        <Icon className="size-[1.125rem] shrink-0" aria-hidden />
        {row.label}
      </span>
    );
  }
  return (
    <Link
      href={row.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-lg px-3 text-[0.9375rem] transition-colors",
        active ? "bg-muted text-foreground font-semibold" : "text-foreground/80 hover:bg-muted/60",
      )}
    >
      <Icon className={cn("size-[1.125rem] shrink-0", active ? "text-foreground" : "text-muted-foreground")} aria-hidden />
      {row.label}
    </Link>
  );
}

/** The places you can switch to, plus All places and Claim a place. */
function PlaceList({ places, currentId, pathname, isSuperAdmin }: { places: ShellPlace[]; currentId: string | null; pathname: string; isSuperAdmin: boolean }) {
  const item = "hover:bg-muted/60 flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm";
  return (
    <div className="flex flex-col gap-0.5">
      {places.map((p) => (
        <Link key={p.id} href={placeTabHref(p.id, "profile")} className={item} aria-current={p.id === currentId ? "true" : undefined}>
          <PlacePhoto place={p} className="size-7" />
          <span className="min-w-0 flex-1 truncate">{p.name ?? "Unnamed place"}</span>
          {p.id === currentId ? <Check className="text-foreground size-4 shrink-0" aria-hidden /> : null}
        </Link>
      ))}
      {places.length > 0 ? <div className="border-border my-1 border-t" /> : null}
      <Link href="/places" className={cn(item, pathname === "/places" && "font-semibold")}>
        <LayoutGrid className="text-muted-foreground size-4 shrink-0" aria-hidden />
        All places
      </Link>
      <Link href="/claim" className={item}>
        <Plus className="text-muted-foreground size-4 shrink-0" aria-hidden />
        Claim a place
      </Link>
      {isSuperAdmin ? (
        <Link href="/internal" className={cn(item, pathname === "/internal" && "font-semibold")}>
          <ShieldCheck className="text-muted-foreground size-4 shrink-0" aria-hidden />
          Internal · Mesita staff
        </Link>
      ) : null}
    </div>
  );
}

function Account({ email, className }: { email: string | null; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2", className)}>
      <span className="text-muted-foreground min-w-0 flex-1 truncate px-3 text-xs" title={email ?? undefined}>
        {email ?? "Signed in"}
      </span>
      <form action={authSignOut}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-10 items-center justify-center rounded-lg"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

// ── The rail (light, compact; MESITA-3116) ─────────────────────────────────

function RailLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground type-label px-2.5 pt-5 pb-1 font-semibold tracking-wide uppercase">{children}</div>;
}

function RailRow({ row, pathname }: { row: Row; pathname: string }) {
  const Icon = row.icon;
  const base = "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors";
  if (!row.href) {
    return (
      <span aria-disabled title="Choose a place first" className={cn(base, "text-muted-foreground/50")}>
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{row.label}</span>
      </span>
    );
  }
  const active = isActive(pathname, row);
  return (
    <Link
      href={row.href}
      aria-current={active ? "page" : undefined}
      className={cn(base, active ? "bg-muted text-foreground font-semibold" : "text-foreground/75 hover:bg-muted/60 hover:text-foreground")}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")} aria-hidden />
      <span className="truncate">{row.label}</span>
    </Link>
  );
}

function RailSwitcher({ places, current, placeId, pathname, isSuperAdmin }: { places: ShellPlace[]; current: ShellPlace | null; placeId: string | null; pathname: string; isSuperAdmin: boolean }) {
  const title = current?.name ?? (placeId ? "Staff view" : "Choose a place");
  return (
    // key: a navigation closes the panel.
    <details key={pathname} className="relative mt-5">
      <summary className="border-border hover:bg-muted/60 flex h-10 cursor-pointer list-none items-center gap-2.5 rounded-lg border px-2 [&::-webkit-details-marker]:hidden">
        <PlacePhoto place={current} className="size-6 rounded-md" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </summary>
      <div className="border-border bg-card shadow-elev absolute inset-x-0 top-full z-40 mt-1 rounded-xl border p-1.5">
        <PlaceList places={places} currentId={current?.id ?? null} pathname={pathname} isSuperAdmin={isSuperAdmin} />
      </div>
    </details>
  );
}

function RailAccount({ email }: { email: string | null }) {
  return (
    <div className="border-border mt-2 flex items-center gap-2 border-t pt-3">
      <span className="text-muted-foreground min-w-0 flex-1 truncate px-2.5 text-xs" title={email ?? undefined}>
        {email ?? "Signed in"}
      </span>
      <form action={authSignOut}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

export function BusinessShell({
  places,
  isSuperAdmin,
  email,
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
  const rows = placeRows(placeId);
  const lower = moreRows(placeId);

  return (
    <div className="min-h-dvh">
      <aside className="border-border bg-card fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r px-3 pt-5 pb-3 lg:flex">
        <Link href="/places" className="flex items-center gap-2 px-2.5">
          <MesitaMark className="size-6 shrink-0 text-(--brand-pink)" />
          <span className="text-base font-semibold tracking-tight">Business</span>
        </Link>
        <RailSwitcher places={places} current={current} placeId={placeId} pathname={pathname} isSuperAdmin={isSuperAdmin} />
        <nav aria-label="Business" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          <RailLabel>Place</RailLabel>
          {rows.map((r) => <RailRow key={r.key} row={r} pathname={pathname} />)}
          <RailLabel>Mesita</RailLabel>
          {lower.map((r) => <RailRow key={r.key} row={r} pathname={pathname} />)}
        </nav>
        <RailAccount email={email} />
      </aside>

      <header className="border-border bg-card/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur lg:hidden">
        <PlacePhoto place={current} className="size-8" />
        <span className="min-w-0 truncate text-sm font-semibold">{current?.name ?? (placeId ? "Staff view" : "Mesita Business")}</span>
      </header>

      <div className="pb-20 lg:pb-0 lg:pl-60">
        <main className="mx-auto w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
      </div>

      <nav aria-label="Business" className="border-border bg-card/95 pb-safe fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:hidden">
        <div className="grid h-16 grid-cols-4">
          {[...rows, lower[0]].map((r) => {
            const Icon = r.icon;
            const cls = "flex flex-col items-center justify-center gap-1 text-xs font-medium";
            if (!r.href) {
              return (
                <span key={r.key} className={cn(cls, "text-muted-foreground opacity-40")} aria-disabled>
                  <Icon className="size-5" aria-hidden />
                  {r.label}
                </span>
              );
            }
            const active = isActive(pathname, r);
            return (
              <Link key={r.key} href={r.href} aria-current={active ? "page" : undefined} className={cn(cls, active ? "text-foreground" : "text-muted-foreground")}>
                <Icon className="size-5" aria-hidden />
                {r.label}
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

/** The phone's More page: the place selector's list and the account. */
export function MoreList({ places, isSuperAdmin, email }: { places: ShellPlace[]; isSuperAdmin: boolean; email: string | null }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="type-eyebrow text-muted-foreground px-2">Your places</h2>
        <PlaceList places={places} currentId={null} pathname={pathname} isSuperAdmin={isSuperAdmin} />
      </section>
      <NavRow row={{ key: "products", label: "Products", icon: Package, href: "/products" }} pathname={pathname} />
      <div className="border-border rounded-xl border">
        <Account email={email} />
      </div>
    </div>
  );
}
