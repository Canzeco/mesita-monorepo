"use client";

// The Business app's frame (MESITA-3103; menu Pato, 2026-11-02, MESITA-3117):
//
//   Logo
//   Place     — a page you open (/places), not a dropdown
//   Profile   — the current place's
//   Premier   — the current place's
//   Settings  — the current place's, the products listed at its foot
//
// As a phone emulator like the consumer app (MESITA-3118): one phone-wide
// card; a top bar (the mark, "Business", sign-out); the four as the bottom
// tab bar, Place wearing the selected place's photo as Me wears the guest's.
// The current place is the one in the URL, else the first you run; without
// one, Profile and Premier wait and Settings shows the products alone.
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

  return (
    // The consumer app's emulator (MobileFrame, MESITA-3118): one phone-wide
    // card, full height on a phone, centred on the hero with a thin margin
    // and rounded corners on a desktop.
    <div className="bg-background md:bg-hero flex h-dvh items-stretch justify-center md:items-center md:py-4">
      <div className="bg-background border-border relative flex h-full w-full max-w-md flex-col overflow-hidden border md:shadow-elev md:h-[calc(100dvh-2rem)] md:rounded-3xl">
        <header className="border-border bg-card/95 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <MesitaMark className="size-6 shrink-0 text-(--brand-pink)" />
          <span className="flex-1 text-base font-semibold tracking-tight">Business</span>
          <SignOut />
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-8">{children}</main>

        <nav aria-label="Business" className="border-border bg-card/95 pb-safe shrink-0 border-t px-0.5 pt-2 backdrop-blur">
          <div className="flex items-end justify-around">
            {rows.map((r) => {
              const Icon = r.icon;
              const cls = cn(
                "type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 font-medium transition",
                !r.href ? "text-muted-foreground opacity-40" : r.active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              );
              // Place wears the selected place's photo, as Me wears the guest's.
              const photo = r.key === "place" ? current?.photo : null;
              const body = (
                <>
                  {r.active ? <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" /> : null}
                  <span className={cn("relative flex size-8 items-center justify-center rounded-full transition", r.active && "bg-primary/10 ring-primary/20 ring-1")}>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className={cn("size-6 rounded-full object-cover", r.active && "ring-primary ring-2")} />
                    ) : (
                      <Icon className="size-5" strokeWidth={r.active ? 2.25 : 1.75} aria-hidden />
                    )}
                  </span>
                  <span className="w-full truncate text-center">{r.label}</span>
                </>
              );
              if (!r.href) {
                return (
                  <span key={r.key} aria-disabled title="Choose a place first" className={cls}>
                    {body}
                  </span>
                );
              }
              return (
                <Link key={r.key} href={r.href} aria-current={r.active ? "page" : undefined} className={cls}>
                  {body}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
