"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { MyVenue } from "@/lib/api/venues";

type NavItem = {
  // Sub-path under /unit/[id]/, e.g. "home", "place", "promos".
  slug: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

const NAV: NavItem[] = [
  // Home is the dashboard root; Place / Promos / Validator are the deep
  // work surfaces. Promos owns the plan picker, fiscal toggle, Welcome
  // coupon, and per-tier cashback/discount rates in one place.
  { slug: "home", label: "Home", Icon: LayoutDashboard },
  { slug: "place", label: "Place", Icon: Store },
  { slug: "promos", label: "Promos", Icon: Gift },
  {
    slug: "performance",
    label: "Performance",
    Icon: BarChart3,
    disabled: true,
  },
  { slug: "wallet", label: "Wallet", Icon: Wallet, disabled: true },
  { slug: "team", label: "Team", Icon: Users, disabled: true },
];

// Parse "/unit/<id>/<rest>" → { id, rest }.
function parseUnitPath(pathname: string | null): {
  id: string | null;
  rest: string | null;
} {
  if (!pathname) return { id: null, rest: null };
  const m = pathname.match(/^\/unit\/([^/]+)(?:\/(.*))?$/);
  if (!m) return { id: null, rest: null };
  return { id: m[1] ?? null, rest: m[2] ?? null };
}

// Default admin web origin used to build the "Back to admin" exit shown
// to super-admin operators. Hardcoded to manager.mesita.ai's sibling on
// prod; override per environment by setting NEXT_PUBLIC_ADMIN_WEB_URL.
const ADMIN_WEB_URL_FALLBACK = "https://admin.mesita.ai";

export function Sidebar({
  venues,
  user,
  isSuperAdmin = false,
}: {
  venues: MyVenue[];
  user: { email: string | null; fullName: string | null } | null;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open — otherwise the page
  // behind the backdrop can be swiped.
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

  // Sign-in / sign-up render edge-to-edge: there's no session yet, so the
  // sidebar has nothing to show.
  if (pathname?.startsWith("/sign-")) {
    return null;
  }

  // The active unit is URL-driven (/unit/<venueId>/...). Falls back to the
  // first venue the manager owns when the URL has no unit segment.
  const { id: unitFromPath, rest: subPath } = parseUnitPath(pathname);
  const activeVenue =
    venues.find((v) => v.id === unitFromPath) ?? venues[0] ?? null;
  const activeUnitId = activeVenue?.id ?? null;
  const currentSlug = subPath?.split("/")[0] ?? null;

  const navHref = (slug: string) =>
    activeUnitId ? `/unit/${activeUnitId}/${slug}` : "/";

  // When switching between venues, stay on the same sub-page if possible.
  const switchUnitHref = (venueId: string) => {
    const slug = currentSlug ?? "home";
    return `/unit/${venueId}/${slug}`;
  };

  return (
    <>
      {/* Hamburger — fixed top-left on mobile, never visible on md+. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
        className="border-border bg-card text-foreground hover:bg-muted fixed top-3 left-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border transition md:hidden"
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
          "border-border bg-card z-40 flex h-full w-72 shrink-0 flex-col border-r",
          "fixed inset-y-0 left-0 -translate-x-full transition-transform duration-200 ease-out",
          drawerOpen && "translate-x-0",
          "md:relative md:w-64 md:translate-x-0 md:transition-none",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="bg-peacock shadow-glow flex h-7 w-7 items-center justify-center rounded-full text-sm">
              🦚
            </span>
            <span className="font-display text-base font-semibold tracking-tight">
              mesita.
            </span>
          </Link>
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
            isSuperAdmin ? (
              <SuperAdminVenueCard venue={activeVenue} />
            ) : (
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
                      href="/add"
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
            )
          ) : (
            <EmptyUnitTrigger isAuthenticated={!!user} />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map(({ slug, label, Icon, disabled }) =>
            disabled ? (
              <SidebarDisabled
                key={slug}
                Icon={Icon}
                label={label}
                className="py-2.5"
              />
            ) : (
              <Link
                key={slug}
                href={navHref(slug)}
                onClick={closeDrawer}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  currentSlug === slug
                    ? "bg-secondary/10 text-secondary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ),
          )}
        </nav>

        <div className="space-y-1 px-3 pt-3 pb-4">
          {isSuperAdmin && <BackToAdminLink />}
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
                redirectTo="/"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition"
                label=""
              />
            </div>
          ) : (
            <Link
              href="/"
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
  className,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  // Default vertical padding is py-2 (footer items). The main-nav usage
  // passes py-2.5 so the disabled row lines up with the active Link
  // beside it.
  className?: string;
}) {
  return (
    <div
      aria-disabled
      className={cn(
        "text-muted-foreground/50 flex cursor-not-allowed items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium",
        className,
      )}
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

// Static venue identifier shown to super-admin operators instead of the
// venue picker. Super-admins always operate on the one venue they
// deep-linked to from the admin console; there's nothing to pick.
function SuperAdminVenueCard({ venue }: { venue: MyVenue }) {
  return (
    <div className="border-border bg-background flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5">
      <UnitAvatar name={venue.name} />
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-base leading-tight font-semibold tracking-tight">
          {venue.name}
        </p>
        <p className="text-muted-foreground truncate text-[11px]">
          {venueSubtitle(venue)}
        </p>
      </div>
    </div>
  );
}

// Exit hatch shown in super-admin mode so operators can hop back to the
// admin console (where they pick a different venue by Google Place ID).
function BackToAdminLink() {
  const adminOrigin =
    (process.env.NEXT_PUBLIC_ADMIN_WEB_URL ?? "").trim() ||
    ADMIN_WEB_URL_FALLBACK;
  return (
    <Link
      href={`${adminOrigin.replace(/\/$/, "")}/update`}
      className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition"
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="flex-1">Back to admin</span>
    </Link>
  );
}

function EmptyUnitTrigger({ isAuthenticated }: { isAuthenticated: boolean }) {
  const href = isAuthenticated ? "/add" : "/";
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

function personInitial(fullName: string | null, email: string | null): string {
  const source = (fullName ?? email ?? "").trim();
  return source.slice(0, 1).toUpperCase() || "?";
}

function accountLabel(email: string | null): string {
  if (!email) return "Signed in";
  const local = email.split("@")[0] ?? email;
  return local;
}
