"use client";

// The Business app's frame (MESITA-3103; menu Pato, 2026-11-02, MESITA-3117):
//
//   Logo
//   Place     — a page you open (/places), not a dropdown
//   Profile   — the current place's
//   Premier   — the current place's
//   Settings  — the current place's, the products listed at its foot
//   Account   — the Google email and sign-out, at the bottom
//
// The current place is the one in the URL, else the first you run; without
// one, Profile and Premier wait and Settings shows the products alone.
// Phone: the same four as a tab bar; sign-out sits in the top bar.
//
// Hiding a row is never the gate: every place door asks the server
// (business-web-* → place-access) and a stranger gets 404.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, IdCard, LogOut, Settings, Store, type LucideIcon } from "lucide-react";
import { authSignOut } from "@/app/auth/actions";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { placeIdFromPathname, placeTabHref } from "@/lib/place-tabs";
import { cn } from "@/lib/utils";

export type ShellPlace = { id: string; name: string | null; photo: string | null };

type Row = { key: string; label: string; icon: LucideIcon; href: string | null; active: boolean };

function menu(pathname: string, placeId: string | null): Row[] {
  const tab = (t: "profile" | "premier" | "settings") => (placeId ? placeTabHref(placeId, t) : null);
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
    { key: "premier", label: "Premier", icon: BadgeCheck, href: tab("premier"), active: under(tab("premier")) },
    { key: "settings", label: "Settings", icon: Settings, href: settings, active: under(settings) || pathname === "/settings" },
  ];
}

function RailRow({ row }: { row: Row }) {
  const Icon = row.icon;
  const base = "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors";
  if (!row.href) {
    return (
      <span aria-disabled title="Choose a place first" className={cn(base, "text-muted-foreground/50")}>
        <Icon className="size-4 shrink-0" aria-hidden />
        {row.label}
      </span>
    );
  }
  return (
    <Link
      href={row.href}
      aria-current={row.active ? "page" : undefined}
      className={cn(base, row.active ? "bg-muted text-foreground font-semibold" : "text-foreground/75 hover:bg-muted/60 hover:text-foreground")}
    >
      <Icon className={cn("size-4 shrink-0", row.active ? "text-foreground" : "text-muted-foreground")} aria-hidden />
      {row.label}
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
  const rows = menu(pathname, placeId);

  return (
    <div className="min-h-dvh">
      <aside className="border-border bg-card fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r px-3 pt-5 pb-3 lg:flex">
        <Link href="/places" className="flex items-center gap-2 px-2.5">
          <MesitaMark className="size-6 shrink-0 text-(--brand-pink)" />
          <span className="text-base font-semibold tracking-tight">Business</span>
        </Link>
        <nav aria-label="Business" className="mt-6 flex flex-1 flex-col gap-0.5">
          {rows.map((r) => <RailRow key={r.key} row={r} />)}
        </nav>
        <div className="border-border flex items-center gap-2 border-t pt-3">
          <span className="text-muted-foreground min-w-0 flex-1 truncate px-2.5 text-xs" title={email ?? undefined}>
            {email ?? "Signed in"}
          </span>
          <SignOut />
        </div>
      </aside>

      <header className="border-border bg-card/95 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4 backdrop-blur lg:hidden">
        <MesitaMark className="size-6 shrink-0 text-(--brand-pink)" />
        <span className="flex-1 text-base font-semibold tracking-tight">Business</span>
        <SignOut />
      </header>

      <div className="pb-20 lg:pb-0 lg:pl-60">
        <main className="mx-auto w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
      </div>

      <nav aria-label="Business" className="border-border bg-card/95 pb-safe fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:hidden">
        <div className="grid h-16 grid-cols-4">
          {rows.map((r) => {
            const Icon = r.icon;
            const cls = "flex flex-col items-center justify-center gap-1 text-xs font-medium";
            if (!r.href) {
              return (
                <span key={r.key} aria-disabled className={cn(cls, "text-muted-foreground opacity-40")}>
                  <Icon className="size-5" aria-hidden />
                  {r.label}
                </span>
              );
            }
            return (
              <Link key={r.key} href={r.href} aria-current={r.active ? "page" : undefined} className={cn(cls, r.active ? "text-foreground" : "text-muted-foreground")}>
                <Icon className="size-5" aria-hidden />
                {r.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
