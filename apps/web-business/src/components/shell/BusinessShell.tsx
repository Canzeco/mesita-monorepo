"use client";

// The Business app's frame (MESITA-3103, menu MESITA-3111).
//
// Desktop rail, top to bottom:
//   the place switcher (the place in the URL, else your first place) →
//   that place's pages (Profile · Premier · Settings), only with a place →
//   Internal for staff → Coming soon as one quiet line → the account.
// Phone: a tab bar (the place's three pages + More); More holds the rest.
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
import { MesitaWordmark } from "@/components/brand/MesitaWordmark";
import { placeIdFromPathname, placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { cn } from "@/lib/utils";

export type ShellPlace = { id: string; name: string | null; photo: string | null };

type Row = { key: string; label: string; icon: LucideIcon; href: string };

const SOON = [
  { key: "payments", label: "Payments", href: "/payments" },
  { key: "prepayments", label: "Prepayments", href: "/prepayments" },
  { key: "rewards", label: "Rewards", href: "/rewards" },
] as const;

function placeRows(placeId: string): Row[] {
  const href = (tab: PlaceTab) => placeTabHref(placeId, tab);
  return [
    { key: "profile", label: "Profile", icon: Store, href: href("profile") },
    { key: "premier", label: "Premier", icon: BadgeCheck, href: href("premier") },
    { key: "settings", label: "Settings", icon: Settings, href: href("settings") },
  ];
}

function isActive(pathname: string, row: Row): boolean {
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
function PlaceList({ places, currentId, pathname }: { places: ShellPlace[]; currentId: string | null; pathname: string }) {
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
    </div>
  );
}

function Switcher({ places, current, placeId, pathname }: { places: ShellPlace[]; current: ShellPlace | null; placeId: string | null; pathname: string }) {
  const title = current?.name ?? (placeId ? "Staff view" : "Choose a place");
  const subtitle = current ? "Your place" : placeId ? "A place you don't run" : `${places.length ? "Pick one of yours" : "Claim yours to start"}`;
  return (
    // key: a navigation closes the panel.
    <details key={pathname} className="group relative mx-3 mb-2">
      <summary className="border-border hover:bg-muted/60 flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl border px-3 py-2 [&::-webkit-details-marker]:hidden">
        <PlacePhoto place={current} className="size-9" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground block truncate text-xs">{subtitle}</span>
        </span>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </summary>
      <div className="border-border bg-card shadow-elev absolute inset-x-0 top-full z-40 mt-1 rounded-xl border p-1.5">
        <PlaceList places={places} currentId={current?.id ?? null} pathname={pathname} />
      </div>
    </details>
  );
}

function SoonLine() {
  return (
    <p className="text-muted-foreground px-3 text-xs leading-relaxed">
      <span className="type-eyebrow mr-1.5">Soon</span>
      {SOON.map((s, i) => (
        <span key={s.key}>
          {i > 0 ? " · " : null}
          <Link href={s.href} className="hover:text-foreground underline-offset-2 hover:underline">
            {s.label}
          </Link>
        </span>
      ))}
    </p>
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
  const rows = placeId ? placeRows(placeId) : [];
  const internal: Row = { key: "internal", label: "Internal", icon: ShieldCheck, href: "/internal" };

  return (
    <div className="min-h-dvh">
      <aside className="border-border bg-card fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r lg:flex">
        <Link href="/places" className="flex items-center gap-2 px-6 pt-5 pb-4">
          <MesitaMark className="size-7 text-(--brand-pink)" />
          <MesitaWordmark className="h-5 w-auto" />
          <span className="type-eyebrow text-muted-foreground ml-1">Business</span>
        </Link>
        <Switcher places={places} current={current} placeId={placeId} pathname={pathname} />
        <nav aria-label="Business" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-1 pb-4">
          {rows.map((r) => <NavRow key={r.key} row={r} pathname={pathname} />)}
          {isSuperAdmin ? (
            <>
              <div className="type-eyebrow text-muted-foreground px-3 pt-5 pb-2">Mesita staff</div>
              <NavRow row={internal} pathname={pathname} />
            </>
          ) : null}
          <div className="mt-auto pt-6">
            <SoonLine />
          </div>
        </nav>
        <Account email={email} className="border-border border-t py-3" />
      </aside>

      <header className="border-border bg-card/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur lg:hidden">
        <PlacePhoto place={current} className="size-8" />
        <span className="min-w-0 truncate text-sm font-semibold">{current?.name ?? (placeId ? "Staff view" : "Mesita Business")}</span>
      </header>

      <div className="pb-20 lg:pb-0 lg:pl-64">
        <main className="mx-auto w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
      </div>

      <nav aria-label="Business" className="border-border bg-card/95 pb-safe fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:hidden">
        <div className="grid h-16 grid-cols-4">
          {(placeId ? placeRows(placeId) : placeRows("")).map((r) => {
            const Icon = r.icon;
            const cls = "flex flex-col items-center justify-center gap-1 text-xs font-medium";
            if (!placeId) {
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

/** The phone's More page: places, staff, Coming soon and the account. */
export function MoreList({ places, isSuperAdmin, email }: { places: ShellPlace[]; isSuperAdmin: boolean; email: string | null }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="type-eyebrow text-muted-foreground px-2">Your places</h2>
        <PlaceList places={places} currentId={null} pathname={pathname} />
      </section>
      {isSuperAdmin ? (
        <section className="flex flex-col gap-2">
          <h2 className="type-eyebrow text-muted-foreground px-2">Mesita staff</h2>
          <NavRow row={{ key: "internal", label: "Internal", icon: ShieldCheck, href: "/internal" }} pathname={pathname} />
        </section>
      ) : null}
      <SoonLine />
      <div className="border-border rounded-xl border">
        <Account email={email} />
      </div>
    </div>
  );
}
