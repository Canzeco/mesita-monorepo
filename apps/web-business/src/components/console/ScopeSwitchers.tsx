"use client";

// The two switchers — change organization, change place — ON THE
// ORGANIZATION PAGE (MESITA-1822).
//
// Pato, 2026-09-13, on the rail carrying them as rows: "still looks like
// fucking shit. wtf? i told you: Account. Organization. (change
// organization, change place) Place Profile …". The parenthesis names what
// the Organization PAGE does. So the rail is seven rows and nothing else,
// and this strip sits under the organization's name: the organization
// switcher, the place switcher, each a chip, the name and up-down chevrons,
// with its ceremony in the menu (Create organization · All places · Add
// place).
//
// A SWITCHER WITH NOTHING TO SWITCH IS A NAME (MESITA-1818, 3A): at one
// organization or one place no chevron renders and the row still opens its
// menu as the door. THE TRANSITION IS THE CLOCK: a choice shows the chosen
// name only while the `router.push` it started is in flight.
//
// Reads the shell's scope through RailScopeContext — the same resolution
// the rail and the header use — so the page and the rail cannot disagree.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronsUpDown, Layers, Plus, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpenPlace, useOpenPlaceGuard, type GuardNav } from "@/components/console/OpenPlace";
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
import type { RailPlace } from "@/lib/api/organizations";
import { canAddPlace } from "@/lib/active-organization";
import { SHELL_ROUTES, orgHref, orgPlacesHref, orgPlacesNewHref } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { placeThumbUrl } from "@/lib/place-thumb";
import type { RailOrg } from "@/lib/rail-scope";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TRIGGER = cn(
  "border-border bg-card flex h-10 min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-semibold transition",
  "hover:bg-muted/50 data-[state=open]:bg-muted/50",
  FOCUS_RING,
);
const CHIP =
  "bg-muted text-foreground ring-border flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ring-1";
const MENU_ITEM = "gap-2.5 rounded-lg py-1.5 text-[13px]";
const MENU_STACK = "flex min-w-0 flex-1 flex-col leading-tight";
const MENU_META = "text-muted-foreground block truncate text-[11px] font-normal";

const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;

function orgMeta(org: RailOrg): string {
  const n = org.places.length;
  return `${ROLE_LABEL[org.myRole]} · ${n === 1 ? "1 place" : `${n} places`}`;
}

function OrgChip({ name }: { name: string }) {
  return (
    <span aria-hidden className={CHIP}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function PlaceChip({ place }: { place: RailPlace | null }) {
  const src = place ? placeThumbUrl(place.photoUrl, 20) : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a 20px thumb through the resizer; next/image's layout cost is not worth a chip
      <img src={src} alt="" width={20} height={20} className="ring-border h-5 w-5 shrink-0 rounded-md object-cover ring-1" />
    );
  }
  return (
    <span aria-hidden className={CHIP}>
      <Store className="h-3 w-3" />
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

/** One switcher: eyebrow, then chip + name (+ chevrons at 2+). */
function Switcher({
  eyebrow,
  label,
  chip,
  name,
  switchable,
  pending,
  children,
}: {
  eyebrow: string;
  label: string;
  chip: React.ReactNode;
  name: string;
  switchable: boolean;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
      <span className={cn(TINY_LABEL_CLASS, "px-0.5")}>{eyebrow}</span>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label={label}
          aria-busy={pending || undefined}
          title={`${label}: ${name}`}
          className={TRIGGER}
        >
          {chip}
          <span className="min-w-0 flex-1 truncate">{name}</span>
          {switchable && (
            <ChevronsUpDown aria-hidden className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="w-72 motion-reduce:animate-none">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ScopeSwitchers() {
  const ctx = useRailScopeContext();
  const router = useRouter();
  const guardNav = useOpenPlaceGuard();
  const openPlace = useOpenPlace();
  const [choice, setChoice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (!ctx) return null;
  const { scope, organizations, isSuperAdmin } = ctx;
  const org = scope.org;
  if (!org) return null;
  const pendingId = isPending ? choice : null;
  const pendingOrg = pendingId ? organizations.find((o) => o.id === pendingId) : null;
  const pendingPlace = pendingId ? org.places.find((p) => p.id === pendingId) : null;
  const canAdd = canAddPlace(org.myRole);
  const place = scope.place;
  // A place opened from the list that no organization of the viewer's holds.
  const foreignName =
    scope.foreignPlaceId !== null && openPlace?.id === scope.foreignPlaceId ? openPlace.name : null;

  const go = (href: string, id: string) => {
    if (guardNav?.(href)) return;
    setChoice(id);
    startTransition(() => router.push(href));
  };
  const pickOrg = (id: string) => {
    if (id !== org.id) go(orgHref(id), id);
  };
  const pickPlace = (id: string) => {
    if (id === place?.id) return;
    // Opening a place from its organization's page lands on Profile.
    go(placeTabHref(id, "profile"), id);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Switcher
        eyebrow="Organization"
        label="Switch organization"
        chip={<OrgChip name={pendingOrg?.name ?? org.name} />}
        name={pendingOrg?.name ?? org.name}
        switchable={organizations.length >= 2}
        pending={pendingOrg !== null && pendingOrg !== undefined}
      >
        {organizations.length === 1 ? (
          <DropdownMenuLabel className={cn(MENU_ITEM, "flex items-center")}>
            <OrgChip name={org.name} />
            <span className={MENU_STACK}>
              <span className="truncate">{org.name}</span>
              <span className={MENU_META}>{orgMeta(org)}</span>
            </span>
          </DropdownMenuLabel>
        ) : (
          <DropdownMenuRadioGroup value={org.id} onValueChange={pickOrg}>
            {organizations.map((o) => (
              <DropdownMenuRadioItem key={o.id} value={o.id} className={MENU_ITEM}>
                <OrgChip name={o.name} />
                <span className={MENU_STACK}>
                  <span className="truncate">{o.name}</span>
                  <span className={MENU_META}>{orgMeta(o)}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
        <DropdownMenuSeparator />
        <MenuLink href={SHELL_ROUTES.orgNew} label="Create organization" Icon={Plus} onGuardedNavigate={guardNav ?? undefined} />
      </Switcher>

      <Switcher
        eyebrow="Place"
        label="Switch place"
        chip={<PlaceChip place={pendingPlace ?? place} />}
        name={pendingPlace?.name ?? foreignName ?? place?.name ?? (canAdd ? "Add a place" : "No places yet")}
        switchable={org.places.length >= 2}
        pending={pendingPlace !== null && pendingPlace !== undefined}
      >
        {org.places.length === 1 ? (
          <DropdownMenuLabel className={cn(MENU_ITEM, "flex items-center")}>
            <PlaceChip place={org.places[0]} />
            <span className="truncate">{org.places[0].name}</span>
          </DropdownMenuLabel>
        ) : org.places.length > 1 ? (
          <DropdownMenuRadioGroup value={place?.id ?? ""} onValueChange={pickPlace}>
            {org.places.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id} className={MENU_ITEM}>
                <PlaceChip place={p} />
                <span className="truncate">{p.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        ) : (
          <DropdownMenuLabel className={cn(MENU_ITEM, "text-muted-foreground")}>
            {isSuperAdmin ? "No places held yet" : "No places yet"}
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <MenuLink href={orgPlacesHref(org.id)} label="All places" Icon={Layers} onGuardedNavigate={guardNav ?? undefined} />
        {canAdd && (
          <MenuLink href={orgPlacesNewHref(org.id)} label="Add place" Icon={Plus} onGuardedNavigate={guardNav ?? undefined} />
        )}
      </Switcher>
    </div>
  );
}
