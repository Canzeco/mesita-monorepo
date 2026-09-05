"use client";

// Console navigation (Design D5): desktop sidebar ≥ md, slide-over sheet
// below. Client component because active state needs usePathname and every
// href must carry the ?org= switch (useSearchParams). Mock data is plain
// static data, so importing ORGS client-side is fine — this component must
// never import lib/supabase or lib/api.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MockChip } from "@/components/console/badges";
import { ORGS, resolveOrgKey } from "@/lib/mock";
import { placePath, SHELL_ROUTES, withOrg } from "@/lib/console-routes";

const ORG_LINKS = [
  { label: "Activity", href: SHELL_ROUTES.home },
  { label: "Finances", href: SHELL_ROUTES.finances },
  { label: "Members", href: SHELL_ROUTES.members },
  { label: "Commercial", href: SHELL_ROUTES.commercial },
];

function NavLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex h-9 items-center rounded-lg px-3 text-sm transition",
        active
          ? "bg-foreground text-background font-semibold"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgKey = resolveOrgKey(searchParams.get("org") ?? undefined);
  const org = ORGS[orgKey];
  const otherKey = orgKey === "grupo-ruiz" ? "nuevo" : "grupo-ruiz";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-2">
        <MesitaLogo variant="horizontal" className="h-6 w-auto" />
        <MockChip />
      </div>

      {/* Org switcher — link-based so Server Components see the change. */}
      <Link
        href={withOrg("/", otherKey)}
        onClick={onNavigate}
        className="border-border bg-card hover:border-foreground/30 flex items-center justify-between rounded-xl border px-3 py-2 transition"
        title={`Switch to ${ORGS[otherKey].organization.name}`}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {org.organization.name}
          </span>
          <span className="text-muted-foreground block text-[11px]">
            {org.organization.rfc}
          </span>
        </span>
        <span className="text-muted-foreground text-[11px]">Switch</span>
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Organization">
        <span className={cn(TINY_LABEL_CLASS, "px-3 pb-1")}>Organization</span>
        {ORG_LINKS.map((l) => (
          <NavLink
            key={l.href}
            href={withOrg(l.href, orgKey)}
            label={l.label}
            active={isActive(l.href)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <nav className="flex flex-col gap-1" aria-label="Places">
        <span className={cn(TINY_LABEL_CLASS, "px-3 pb-1")}>Places</span>
        <NavLink
          href={withOrg(SHELL_ROUTES.places, orgKey)}
          label="All places"
          active={pathname === SHELL_ROUTES.places}
          onNavigate={onNavigate}
        />
        {org.places.map((p) => (
          <NavLink
            key={p.id}
            href={withOrg(placePath(p.id, "profile"), orgKey)}
            label={p.name}
            active={pathname.startsWith(placePath(p.id))}
            onNavigate={onNavigate}
          />
        ))}
        <span className="text-muted-foreground/70 px-3 py-1.5 text-sm">
          + Add place (soon)
        </span>
      </nav>

      <div className="mt-auto">
        <NavLink
          href={withOrg(SHELL_ROUTES.account, orgKey)}
          label="Account"
          active={isActive(SHELL_ROUTES.account)}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="border-border bg-background sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 md:hidden">
        <div className="flex items-center gap-2">
          <MesitaLogo variant="horizontal" className="h-6 w-auto" />
          <MockChip />
        </div>
        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((v) => !v)}
          className="border-border bg-card flex h-10 w-10 items-center justify-center rounded-full border"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={close}
            className="absolute inset-0 bg-black/30"
          />
          <div className="bg-background absolute inset-y-0 left-0 w-72 shadow-xl">
            <SidebarBody onNavigate={close} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="border-border bg-background sticky top-0 hidden h-screen w-64 shrink-0 border-r md:block">
        <SidebarBody onNavigate={() => undefined} />
      </aside>
    </>
  );
}
