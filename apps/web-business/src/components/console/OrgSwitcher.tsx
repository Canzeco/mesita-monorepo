"use client";

// WHICH ORGANIZATION YOU ARE IN — on the Organization page (MESITA-1847).
//
// Pato, 2026-09-14: *"organization must be selected in organization not
// fucking there, account is just for there."* "There" was Account, which had
// carried both switchers since MESITA-1832 on his own earlier instruction
// ("Account must contain select account, organization selector, and place
// selector"). That was true while the Organization page did not exist. It
// does, it is a rail row, and a selector belongs on the page about the thing
// it selects. Account is the person now, and nothing else.
//
// THE PLACE SWITCHER IS GONE, not moved. It was a menu listing the
// organization's places; the Organization page now LISTS them, each name a
// link into it. A menu whose contents are already on the page one box below
// is a second door to the same room — which is the thing this whole pass
// deletes.
//
// THIS ROW IS THE PAGE'S IDENTITY. It carries the organization's name at
// full weight, so the page renders no visible `h1` above it saying the same
// word; the heading is sr-only on the page itself. A trigger is a `<button>`
// and a heading is not phrasing content, so the `h1` cannot live in here.
//
// A SWITCHER WITH NOTHING TO SWITCH IS A NAME (MESITA-1818, 3A): at one
// organization no chevron renders and the row still opens its menu as the
// door to Create organization. THE TRANSITION IS THE CLOCK: a choice shows
// the chosen name only while the `router.push` it started is in flight.
//
// Reads the shell's scope through RailScopeContext — the same resolution the
// rail and the header use — so the page and the rail cannot disagree.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpenPlaceGuard, type GuardNav } from "@/components/console/OpenPlace";
import { useRailScopeContext } from "@/components/console/RailScopeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SHELL_ROUTES, orgSwitchHref, orgHref } from "@/lib/console-routes";
import type { RailOrg } from "@/lib/rail-scope";
import {
  SCOPE_CARD_CLASS,
  SCOPE_CHIP_CLASS,
  SCOPE_ROW_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TRIGGER = cn(
  SCOPE_ROW_CLASS,
  "transition hover:bg-muted/50 data-[state=open]:bg-muted/50",
  FOCUS_RING,
);
const CHIP_ORG = cn(
  SCOPE_CHIP_CLASS,
  "bg-brand font-display flex items-center justify-center text-base font-semibold text-white",
);
const MENU_CHIP =
  "bg-muted text-foreground ring-border flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ring-1";
const MENU_ITEM = "gap-2.5 rounded-lg py-1.5 text-[13px]";
const MENU_STACK = "flex min-w-0 flex-1 flex-col leading-tight";
const MENU_META = "text-muted-foreground block truncate text-[11px] font-normal";

const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;

function orgMeta(org: RailOrg): string {
  const n = org.places.length;
  return `${ROLE_LABEL[org.myRole]} · ${n === 1 ? "1 place" : `${n} places`}`;
}

function OrgChip({ name, menu = false }: { name: string; menu?: boolean }) {
  return (
    <span aria-hidden className={menu ? MENU_CHIP : CHIP_ORG}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function MenuLink({
  href,
  label,
  Icon,
  onGuardedNavigate,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  onGuardedNavigate?: GuardNav;
}) {
  return (
    <DropdownMenuItem asChild className={cn(MENU_ITEM, "text-muted-foreground")}>
      <Link href={href} onClick={(e) => onGuardedNavigate?.(href, e)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Link>
    </DropdownMenuItem>
  );
}

export function OrgSwitcher() {
  const ctx = useRailScopeContext();
  const router = useRouter();
  const guardNav = useOpenPlaceGuard();
  const [choice, setChoice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (!ctx) return null;
  const { scope, organizations } = ctx;
  const org = scope.org;
  if (!org) return null;
  const pendingId = isPending ? choice : null;
  const pendingOrg = pendingId ? organizations.find((o) => o.id === pendingId) : null;
  const shown = pendingOrg ?? org;

  const pickOrg = (id: string) => {
    // `/orgs/<id>/switch` is the forwarder: it writes the org cookie, clears
    // the place cookie and lands on the organization you picked. Every other
    // organization address is a PAGE (MESITA-1846), and a page cannot set a
    // cookie on the way through — which is the only reason that one exists.
    if (id === org.id) return;
    const href = orgSwitchHref(id, orgHref(id, "organization"));
    if (guardNav?.(href)) return;
    setChoice(id);
    startTransition(() => router.push(href));
  };

  const switchable = organizations.length >= 2;

  return (
    <div className={SCOPE_CARD_CLASS}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label="Switch organization"
          aria-busy={pendingOrg ? true : undefined}
          title={`Switch organization: ${shown.name}`}
          className={TRIGGER}
        >
          <OrgChip name={shown.name} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={TINY_LABEL_CLASS}>Organization</span>
            <span className="mt-0.5 truncate text-base font-semibold">
              {shown.name}
            </span>
            <span className="text-muted-foreground truncate text-[12px]">
              {orgMeta(shown)}
            </span>
          </span>
          {switchable && (
            <ChevronsUpDown aria-hidden className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-72 motion-reduce:animate-none">
          {organizations.length === 1 ? (
            <DropdownMenuLabel className={cn(MENU_ITEM, "flex items-center")}>
              <OrgChip name={org.name} menu />
              <span className={MENU_STACK}>
                <span className="truncate">{org.name}</span>
                <span className={MENU_META}>{orgMeta(org)}</span>
              </span>
            </DropdownMenuLabel>
          ) : (
            <DropdownMenuRadioGroup value={org.id} onValueChange={pickOrg}>
              {organizations.map((o) => (
                <DropdownMenuRadioItem key={o.id} value={o.id} className={MENU_ITEM}>
                  <OrgChip name={o.name} menu />
                  <span className={MENU_STACK}>
                    <span className="truncate">{o.name}</span>
                    <span className={MENU_META}>{orgMeta(o)}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
          <DropdownMenuSeparator />
          <MenuLink
            href={SHELL_ROUTES.orgNew}
            label="Create organization"
            Icon={Plus}
            onGuardedNavigate={guardNav ?? undefined}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
