"use client";

// The two switchers — change organization, change place — ON ACCOUNT
// (MESITA-1832: "Account must contain select account, organization selector,
// and place selector"; on the organization page from MESITA-1822 until then).
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
// THE CHIP-SIZED TRIGGER IS GONE (MESITA-1833). Pato, 2026-09-14: "make this
// prettier … far prettier". The two switchers were 40px bordered chips on the
// bare background while the signed-in EMAIL sat in a card — the page's whole
// subject rendered lighter than its trivia. Each is a full row now: 36px chip,
// the role as an eyebrow INSIDE the row, the name at 14px semibold, and the
// meta the menu already computes (`Owner · 1 place`) surfaced ON the trigger
// instead of hidden one click behind it. 64px tall, which also clears the 44px
// touch minimum the old `h-10` failed.
//
// A SWITCHER WITH NOTHING TO ADD IS AN EMPTY STATE. At zero places the old
// build put "Add a place" where a NAME goes, and — nothing to switch — drew no
// chevron, so a call to action looked like a disabled field. With an empty
// catalogue that is the state every account is in. It is dashed, plus-chipped
// and brand-pink now: the one shape in this file that reads as "do something".
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
// 64px so the row clears the 44px touch minimum with room for three lines.
const TRIGGER = cn(
  "border-border bg-card flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition",
  "hover:bg-muted/50 data-[state=open]:bg-muted/50",
  FOCUS_RING,
);
// The "nothing here yet" row: dashed against the solid live one, the same
// idiom EmptyState uses, so the two read as one vocabulary.
const TRIGGER_EMPTY = "border-dashed bg-transparent";
const CHIP =
  "bg-muted text-muted-foreground ring-border flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ring-1";
// The organization wears the brand; the place wears its own photo. Two
// different kinds of thing, so they never look interchangeable.
const CHIP_ORG =
  "bg-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-semibold text-white";
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

function PlaceChip({ place, menu = false }: { place: RailPlace | null; menu?: boolean }) {
  const px = menu ? 20 : 36;
  const src = place ? placeThumbUrl(place.photoUrl, px) : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a small thumb through the resizer; next/image's layout cost is not worth a chip
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        className={cn(
          "ring-border shrink-0 object-cover ring-1",
          menu ? "h-5 w-5 rounded-md" : "h-9 w-9 rounded-xl",
        )}
      />
    );
  }
  return (
    <span aria-hidden className={menu ? MENU_CHIP : CHIP}>
      <Store className={menu ? "h-3 w-3" : "h-4 w-4"} />
    </span>
  );
}

/** The zero-places chip: a plus, not a storefront. Nothing to depict yet. */
function AddChip() {
  return (
    <span aria-hidden className={CHIP}>
      <Plus className="h-4 w-4" />
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

/** One switcher, as a row: chip · eyebrow + name + meta · chevrons at 2+. */
function Switcher({
  eyebrow,
  label,
  chip,
  name,
  meta,
  switchable,
  pending,
  empty = false,
  children,
}: {
  eyebrow: string;
  label: string;
  chip: React.ReactNode;
  name: string;
  /** The one line under the name — what the menu would have told you. */
  meta: string;
  switchable: boolean;
  pending: boolean;
  /** Nothing to switch AND nothing to switch TO: the add-one state. */
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        aria-busy={pending || undefined}
        title={`${label}: ${name}`}
        className={cn(TRIGGER, empty && TRIGGER_EMPTY)}
      >
        {chip}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={TINY_LABEL_CLASS}>{eyebrow}</span>
          <span
            className={cn(
              "truncate text-sm font-semibold",
              empty && "text-[color:var(--brand-pink-text)]",
            )}
          >
            {name}
          </span>
          <span className="text-muted-foreground truncate text-[11px]">{meta}</span>
        </span>
        {switchable && (
          <ChevronsUpDown aria-hidden className="text-muted-foreground h-4 w-4 shrink-0" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-72 motion-reduce:animate-none">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
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
    // The forwarder writes the org cookie and lands back on Account.
    if (id !== org.id) go(`${orgHref(id)}?to=${SHELL_ROUTES.account}`, id);
  };
  const pickPlace = (id: string) => {
    if (id === place?.id) return;
    // Opening a place from its organization's page lands on Profile.
    go(placeTabHref(id, "profile"), id);
  };

  // What each row says under its name. The organization's is the role and
  // the holding, already computed for the menu; the place's is which
  // organization it belongs to — the scope question this page exists to
  // answer — or, with none, the honest reason there is no chevron.
  const shownPlace = pendingPlace ?? place;
  const placeEmpty = shownPlace === null && foreignName === null;
  const placeMeta = foreignName
    ? "Not in your organizations"
    : shownPlace
      ? `In ${org.name}`
      : canAdd
        ? "Nothing to switch between yet"
        : "This organization holds none";

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      <Switcher
        eyebrow="Organization"
        label="Switch organization"
        chip={<OrgChip name={pendingOrg?.name ?? org.name} />}
        name={pendingOrg?.name ?? org.name}
        meta={orgMeta(pendingOrg ?? org)}
        switchable={organizations.length >= 2}
        pending={pendingOrg !== null && pendingOrg !== undefined}
      >
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
        <MenuLink href={SHELL_ROUTES.orgNew} label="Create organization" Icon={Plus} onGuardedNavigate={guardNav ?? undefined} />
      </Switcher>

      <Switcher
        eyebrow="Place"
        label="Switch place"
        chip={placeEmpty && canAdd ? <AddChip /> : <PlaceChip place={shownPlace} />}
        name={
          shownPlace?.name ??
          foreignName ??
          (canAdd ? "Add your first place" : "No place yet")
        }
        meta={placeMeta}
        empty={placeEmpty && canAdd}
        switchable={org.places.length >= 2}
        pending={pendingPlace !== null && pendingPlace !== undefined}
      >
        {org.places.length === 1 ? (
          <DropdownMenuLabel className={cn(MENU_ITEM, "flex items-center")}>
            <PlaceChip place={org.places[0]} menu />
            <span className="truncate">{org.places[0].name}</span>
          </DropdownMenuLabel>
        ) : org.places.length > 1 ? (
          <DropdownMenuRadioGroup value={place?.id ?? ""} onValueChange={pickPlace}>
            {org.places.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id} className={MENU_ITEM}>
                <PlaceChip place={p} menu />
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
