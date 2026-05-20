"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Gift,
  BarChart3,
  Wallet,
  Users,
  ChevronDown,
  Check,
  Plus,
  Settings,
  LifeBuoy,
  PlayCircle,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { MyVenue } from "@/lib/api/venues";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  disabled?: boolean;
};

const NAV: NavItem[] = [
  // Home is the dashboard root; Place / Promos / Validator are the deep
  // work surfaces. Promos owns the plan picker, fiscal toggle, Welcome
  // coupon, and per-tier cashback/discount rates in one place.
  { href: "/manager/home", label: "Home", Icon: LayoutDashboard },
  { href: "/manager/place", label: "Place", Icon: Store },
  { href: "/manager/promos", label: "Promos", Icon: Gift },
  {
    href: "/manager/performance",
    label: "Performance",
    Icon: BarChart3,
    disabled: true,
  },
  { href: "/manager/wallet", label: "Wallet", Icon: Wallet, disabled: true },
  { href: "/manager/team", label: "Team", Icon: Users, disabled: true },
];

export function Sidebar({
  venues,
  user,
}: {
  venues: MyVenue[];
  user: { email: string | null; fullName: string | null } | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open — otherwise the page
  // behind the backdrop can be swiped. (Sidebar nav/unit Links close the
  // drawer via their own onClick handlers below — no effect-on-navigation
  // shenanigans needed.)
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  // Auth pages render edge-to-edge under /manager/*: there's no session yet,
  // so the sidebar (unit-picker, nav, profile card) has nothing to show.
  if (pathname?.startsWith("/manager/sign-")) {
    return null;
  }

  // The active unit is URL-driven (?unit=<venueId>). Falls back to the first
  // venue the manager owns when the URL has nothing useful.
  const unitParam = searchParams.get("unit");
  const activeVenue =
    venues.find((v) => v.id === unitParam) ?? venues[0] ?? null;
  const activeUnitId = activeVenue?.id ?? null;
  const navHrefWithUnit = (base: string) =>
    activeUnitId ? `${base}?unit=${activeUnitId}` : base;
  const switchUnitHref = (venueId: string) => {
    const path = pathname ?? "/manager";
    return `${path}?unit=${venueId}`;
  };

  return (
    <>
      {/* Hamburger — fixed top-left on mobile, never visible on md+. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
        className="border-border bg-card text-foreground hover:bg-muted fixed top-3 left-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Backdrop. Only mounted on mobile + when the drawer is open. */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        aria-label="Manager navigation"
        className={cn(
          // Shared
          "border-border bg-card z-40 flex h-full w-72 shrink-0 flex-col border-r",
          // Mobile: fixed-position drawer, slides in from the left.
          "fixed inset-y-0 left-0 -translate-x-full transition-transform duration-200 ease-out",
          drawerOpen && "translate-x-0",
          // Desktop: relative inside the flex layout, always visible, narrower.
          "md:relative md:w-64 md:translate-x-0 md:transition-none",
        )}
      >
        <div className="border-border flex items-center justify-between border-b px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="bg-peacock shadow-glow flex h-8 w-8 items-center justify-center rounded-full text-base">
              🦚
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              mesita.
            </span>
          </Link>
          {/* Close button — mobile-only, sits where the hamburger normally lives. */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full transition md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pt-3">
          {activeVenue ? (
            <>
              <UnitTrigger
                venue={activeVenue}
                open={unitPickerOpen}
                onToggle={() => setUnitPickerOpen((o) => !o)}
              />
              {unitPickerOpen && (
                <div className="border-border bg-card mt-2 overflow-hidden rounded-2xl border">
                  {venues.map((v) => (
                    <Link
                      key={v.id}
                      href={switchUnitHref(v.id)}
                      onClick={() => {
                        setUnitPickerOpen(false);
                        closeDrawer();
                      }}
                      className={cn(
                        "hover:bg-muted/40 flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                        v.id === activeVenue.id && "bg-secondary/5",
                      )}
                    >
                      <UnitAvatar name={v.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm leading-tight font-semibold">
                          {v.name}
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {venueSubtitle(v)}
                        </p>
                      </div>
                      {v.id === activeVenue.id && (
                        <Check className="text-secondary h-4 w-4 shrink-0" />
                      )}
                    </Link>
                  ))}
                  <Link
                    href="/manager/create_unit"
                    onClick={() => {
                      setUnitPickerOpen(false);
                      closeDrawer();
                    }}
                    className="border-border text-secondary hover:bg-secondary/5 flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-sm font-semibold transition"
                  >
                    <Plus className="h-4 w-4" />
                    Add new unit
                  </Link>
                </div>
              )}
            </>
          ) : (
            <EmptyUnitTrigger isAuthenticated={!!user} />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map(({ href, label, Icon, exact, disabled }) => {
            if (disabled) {
              return (
                <div
                  key={href}
                  aria-disabled
                  className="text-muted-foreground/50 flex cursor-not-allowed items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium"
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[9px] font-bold tracking-wider uppercase">
                    Soon
                  </span>
                </div>
              );
            }
            const active = exact
              ? pathname === href
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={navHrefWithUnit(href)}
                onClick={closeDrawer}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-secondary/10 text-secondary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-border space-y-1 border-t p-3">
          <SidebarDisabled Icon={PlayCircle} label="Tutorials" />
          <SidebarDisabled Icon={Settings} label="Settings" />
          <SidebarDisabled Icon={LifeBuoy} label="Help & docs" />

          {user ? (
            <div className="mt-1 flex items-center gap-3 rounded-2xl px-2 py-2">
              <span className="bg-pink-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                {personInitial(user.fullName, user.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {user.fullName ?? accountLabel(user.email)}
                </p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {user.email ?? ""}
                </p>
              </div>
              <SignOutButton
                redirectTo="/manager/sign-in"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition"
                label=""
              />
            </div>
          ) : (
            <Link
              href="/manager/sign-in"
              className="border-border bg-background hover:bg-muted mt-1 flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition"
            >
              Sign in or create account
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

function SidebarDisabled({
  Icon,
  label,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div
      aria-disabled
      className="text-muted-foreground/50 flex cursor-not-allowed items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium"
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[9px] font-bold tracking-wider uppercase">
        Soon
      </span>
    </div>
  );
}

function UnitTrigger({
  venue,
  open,
  onToggle,
}: {
  venue: MyVenue;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="border-border bg-background hover:bg-muted/40 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition"
    >
      <UnitAvatar name={venue.name} />
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-base leading-tight font-semibold tracking-tight">
          {venue.name}
        </p>
        <p className="text-muted-foreground truncate text-[11px]">
          {venueSubtitle(venue)}
        </p>
      </div>
      <ChevronDown
        className={cn(
          "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

function UnitAvatar({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "·";
  return (
    <span className="bg-pink-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-sm">
      {initial}
    </span>
  );
}

function EmptyUnitTrigger({ isAuthenticated }: { isAuthenticated: boolean }) {
  const href = isAuthenticated ? "/manager/create_unit" : "/manager/sign-in";
  return (
    <Link
      href={href}
      className="border-border bg-background hover:border-foreground/30 hover:bg-muted/40 flex w-full items-center gap-3 rounded-2xl border border-dashed px-3 py-2.5 text-left transition"
    >
      <span className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        <Plus className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-base leading-tight font-semibold tracking-tight">
          No venues yet
        </p>
        <p className="text-muted-foreground truncate text-[11px]">
          {isAuthenticated ? "Tap to add your first" : "Sign in to add yours"}
        </p>
      </div>
    </Link>
  );
}

function venueSubtitle(v: MyVenue): string {
  const parts = [v.vibe, v.category].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(" · ");
  return v.address ?? "—";
}

// Prefer the manager's own name over the email local-part for the avatar
// initial — once they've onboarded, their initial should match their face.
function personInitial(fullName: string | null, email: string | null): string {
  const source = (fullName ?? email ?? "").trim();
  return source.slice(0, 1).toUpperCase() || "?";
}

function accountLabel(email: string | null): string {
  if (!email) return "Signed in";
  const local = email.split("@")[0] ?? email;
  return local;
}
