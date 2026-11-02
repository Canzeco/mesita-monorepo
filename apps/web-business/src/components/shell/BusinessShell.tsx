"use client";

// The Business app's frame (MESITA-3103; menu Pato, 2026-11-02, MESITA-3117):
//
//   Logo
//   Place     — a page you open (/places), not a dropdown
//   Profile   — the current place's
//   Reviews   — the current place's reviews, read-only (MESITA-3121)
//   Premier   — the current place's
//   Settings  — the current place's, the products listed at its foot
//   Account   — the Google email and sign-out, at the bottom
//
// The current place is the one in the URL, else the first you run; without
// one, Profile and Premier wait and Settings shows the products alone.
// Desktop web (MESITA-3119): the side menu is the only menu at every width,
// narrowing to icons below lg; Place wears the selected place's photo.
//
// Hiding a row is never the gate: every place door asks the server
// (business-web-* → place-access) and a stranger gets 404.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, IdCard, LogOut, Settings, Star, Store, type LucideIcon } from "lucide-react";
import { authSignOut } from "@/app/auth/actions";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { placeIdFromPathname, placeTabHref } from "@/lib/place-tabs";
import { cn } from "@/lib/utils";

export type ShellPlace = { id: string; name: string | null; photo: string | null };

type Row = { key: string; label: string; icon: LucideIcon; href: string | null; active: boolean };

function menu(pathname: string, placeId: string | null): Row[] {
  const tab = (t: "profile" | "reviews" | "premier" | "settings") => (placeId ? placeTabHref(placeId, t) : null);
  const under = (href: string | null) => !!href && (pathname === href || pathname.startsWith(`${href}/`));
  const settings = tab("settings") ?? "/settings";
  return [
    {
      key: "place",
      label: "Place",
      icon: Store,
      href: "/places",
      active: pathname === "/places" || pathname.startsWith("/claim") || pathname.startsWith("/internal"),
    },
    { key: "profile", label: "Profile", icon: IdCard, href: tab("profile"), active: under(tab("profile")) },
    { key: "reviews", label: "Reviews", icon: Star, href: tab("reviews"), active: under(tab("reviews")) },
    { key: "premier", label: "Premier", icon: BadgeCheck, href: tab("premier"), active: under(tab("premier")) },
    { key: "settings", label: "Settings", icon: Settings, href: settings, active: under(settings) || pathname === "/settings" },
  ];
}

function RailRow({ row, photo }: { row: Row; photo?: string | null }) {
  const Icon = row.icon;
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

function SignOut() {
  return (
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
  );
}

export function BusinessShell({
  places,
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
  const rows = menu(pathname, placeId);

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
          {rows.map((r) => <RailRow key={r.key} row={r} photo={r.key === "place" ? current?.photo : null} />)}
        </nav>
        <div className="border-border flex items-center justify-center gap-2 border-t pt-3 lg:justify-start">
          <span className="text-muted-foreground hidden min-w-0 flex-1 truncate px-2.5 text-xs lg:inline" title={email ?? undefined}>
            {email ?? "Signed in"}
          </span>
          <SignOut />
        </div>
      </aside>

      <div className="pl-16 lg:pl-60">
        <main className="mx-auto w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
