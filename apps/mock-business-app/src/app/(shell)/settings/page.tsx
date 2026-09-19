"use client";

// SETTINGS — the fourth tab: you, what you owe, and this place (MESITA-1973).
//
// IT IS NOT PLACE-SCOPED ANY MORE, and that is load-bearing rather than tidy.
// Sign out lives here now that Account is gone, and `TopNav.tsx` renders the
// place-scoped tabs only in the `solo` and `multi` shapes — so an address of
// the form `/places/<id>/settings` would put the console's only exit behind a
// successful places read. `/settings` resolves with no place at all, which is
// why its tab is the one that draws at all four modes. MESITA-1935 tried this
// merge and missed exactly that; MESITA-1937 undid it for exactly that.
//
// IT READS THE PLACE THE WAY THE MENU DOES, through `resolveRailScope`, not
// through `usePlaceScope` — that context is published by `places/[id]/layout`
// and this page sits outside it. The pathname names no place here, so the scope
// falls back to the last place opened, which is the venue the rail is showing.
//
// THREE SCOPES, TOP TO BOTTOM: the PERSON, the MONEY, then the PLACE. The split
// MESITA-1937 made into two destinations survives as two sections of one page,
// which is what Pato asked for: *"Settings, Account also here"*.
//
// BILLING IS WHAT YOU PAY MESITA, and payouts are deliberately not here. Money
// a guest pays lands in the place's own Stripe account and is read on Online
// Payments; putting the Membership and the payouts on one screen is how
// "Mesita never holds your money" stops being legible.
//
// MEMBERS IS CONTENT, NOT A PAGE. The people used to hang off a layer above the
// place and had an address of their own; nesting them was the complaint that
// deleted that layer. They are a box on this page now.
//
// ONE OWNER/EDITOR/VIEWER SURFACE. There is exactly one place in this console
// where a role is granted, and this is it — two surfaces granting the same
// thing is how one of them ends up granting a role the other cannot revoke.
//
// ── THE STATES CARD IS THIS APP'S OWN (MESITA-1941) ────────────────────────
//
// `web-business` has no such card and this is not a snapshot of one. It says
// what a place IS — its standing and its intake — because nothing else on an
// operator's own screens does. AdminView says some of it and is
// super-admin-only; the place heading wears two badges.
//
// TWO GROUPS, NOT THREE (MESITA-2000). Pato: *"remove the stupid product
// states from settings"*. A third group listed six of the twelve products and
// whether each was on, which was the SETUP INDEX rebuilt here and rebuilt
// short — and rebuilt off the raw `MockPlace` booleans rather than off
// `buildProductCards`, so the two could disagree about one product and both
// look right. The index is the one reader of a product's state. What is left
// is the two facts no other screen carries.
//
// READ-ONLY, and that is the whole design. Every value here is set by Stripe,
// by an operator, or by the scenario panel, and none of them is set from
// Settings. Rows that looked like switches would be a second surface granting
// what one surface already grants — the mistake the Team box above names.
//
// FILL MEANS IN FORCE, NOT "ON". A place that is not promoting shows a FILLED
// "No": the word in the pill is the fact, and the fill only says which of the
// row's values is the live one. Every row prints all of its values, including
// the ones this place is not in, because the states nobody can reach are the
// reason this app exists.
import { Building2, LogOut, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/shared/Badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { MEMBERS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import {
  MEMBERSHIP_STATE_LABEL,
  PAY_LADDER_LABEL,
  PLAN_LABEL,
  type MockPlace,
  type MockPlaceProfile,
} from "@/mock/types";

/** `public.content_state`, as words. The enum is
 *  `queued | generating | ready | failed`; the column is nullable and a null
 *  means the row predates the pipeline, which reads as queued. */
const CONTENT_STATE_LABEL: Record<string, string> = {
  queued: "Queued",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};
import {
  GHOST_PILL_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
  INFO_BOX_CLASS,
  PILL_BUTTON_CLASS,
  SCOPE_CARD_CLASS,
  SCOPE_CHIP_CLASS,
  SCOPE_ROW_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { SHELL_ROUTES } from "@/lib/console-routes";
import { resolveRailScope } from "@/lib/rail-scope";
import { day } from "@/lib/format";
import { cn } from "@/lib/utils";

type StateRow = {
  label: string;
  /** Every value this state can take, in ladder order where it is a ladder. */
  options: string[];
  /** The one in force. Must be a member of `options` — a current that names
   *  nothing would render a row with no fill and no way to tell why. */
  current: string;
  note: string;
};

/** THREE BOXES, NOT TWELVE ROWS (MESITA-1945). Pato, on the one card that was
 *  here: *"different states boxes — General States, Intake States"*.
 *
 *  Twelve rows under one heading is a reference table you scan, not a list you
 *  read, and the twelve were never one kind of thing. What the place IS and
 *  what it is PAYING belong together; the six product switches are the same six
 *  facts the catalogue's cards state and grouping them says so; and the Intaker
 *  has a state of its own that no screen in this console has ever named.
 *
 *  Pato named two groups. The third is the product switches, which fall out of
 *  the same cut — folding them back into General is one `concat`. */
type StateGroup = {
  title: string;
  description: string;
  rows: StateRow[];
};

function stateGroups(
  place: MockPlace,
  profile: MockPlaceProfile | undefined,
): StateGroup[] {
  const yesNo = (on: boolean) => (on ? "Yes" : "No");
  const YES_NO = ["Yes", "No"];

  const general: StateRow[] = [
    {
      label: "Your role",
      options: ["owner", "editor", "viewer"],
      current: place.myRole,
      note: "What this console will open for you. Nothing on this page can raise your own.",
    },
    {
      label: "Verified",
      options: YES_NO,
      current: yesNo(place.verified),
      note: "Mesita checked the place is real.",
    },
    {
      label: "Plan",
      options: Object.values(PLAN_LABEL),
      current: PLAN_LABEL[place.plan],
      note: "What the place bought. Every product names the lowest rung that carries it.",
    },
    {
      label: "Partner",
      options: YES_NO,
      current: yesNo(place.partnered),
      note: "Derived from the plan \u2014 both paid rungs grant it. Never set on its own.",
    },
    {
      label: "Promoting",
      options: YES_NO,
      current: yesNo(place.promoting),
      note: "Buying reach in Discovery. Computed per request, so it can flip with nobody acting.",
    },
    {
      label: "Membership",
      options: Object.values(MEMBERSHIP_STATE_LABEL),
      current: MEMBERSHIP_STATE_LABEL[place.membership],
      note: "What the billing is doing, which is not which rung the place is on. Payment due still entitles.",
    },
    {
      label: "Payments",
      options: Object.values(PAY_LADDER_LABEL),
      current: PAY_LADDER_LABEL[place.pay],
      note: "This place\u2019s own Stripe account. Not set up and Restricted are different facts that Stripe reports the same way.",
    },
  ];

  // THE INTAKER'S OWN STATE, named for the first time. `content_state` is a
  // real `public.content_state` enum with four values, and this console has
  // only ever read two of them — `ProfileCompleteness` checks `generating` and
  // `queued` to explain why its meter lags, then says nothing about which.
  //
  // SCHEMA-BACKED ONLY. Every row below reads a field that exists; none of them
  // is a state invented to fill the box. `failed` in particular is the value an
  // operator most needs named and the one no screen could reach.
  const intake: StateRow[] = profile
    ? [
        {
          label: "Content",
          options: ["Queued", "Generating", "Ready", "Failed"],
          current: CONTENT_STATE_LABEL[profile.content_state ?? ""] ?? "Queued",
          note: "Where the Intaker is with this place. Ready is the only one that means the profile below is finished.",
        },
        {
          label: "Name",
          // A BLANK OVERRIDE IS THE STATE, not a missing value: `mesita_name`
          // empty MEANS "follow Google", which is why this row can never be
          // "not set".
          options: ["Follows Google", "Operator override"],
          current: profile.mesita_name?.trim()
            ? "Operator override"
            : "Follows Google",
          note: "Whose name this place wears. Clearing the override hands it back to Google, it does not blank it.",
        },
        {
          label: "Google place",
          options: ["Linked", "Not linked"],
          current: profile.google_maps_url?.trim() ? "Linked" : "Not linked",
          note: "Whether a Google listing was ever matched. Not linked means every cached rating and photo below came from somewhere else.",
        },
      ]
    : [];

  return [
    {
      title: "General states",
      description:
        "What this place is, and what it is paying. Read-only: these are set by Stripe, by an operator, or by the scenario panel — never from this page.",
      rows: general,
    },
    {
      title: "Intake states",
      description:
        "Where the Intaker got to, and what it owns. Nothing here is set by hand — the pipeline writes all of it.",
      rows: intake,
    },
  ].filter((g) => g.rows.length > 0);
}

export default function SettingsPage() {
  const pathname = usePathname();
  const { scenario, world, viewer, lastPlaceId } = useMock();

  // NO `NotHeld` AND NO `notFound`. This page is the person's, so it renders
  // whatever the places did — including the failed read, where it is the only
  // screen in the console that still has something true to say. The PLACE
  // sections below are what depends on holding one, and they simply do not
  // draw when there is none.
  const scope = resolveRailScope({
    places: world.places,
    pathname,
    lastPlaceId,
    viewerError: world.viewerError,
  });
  // The rail's `RailPlace` is a Pick; the state groups want the whole record.
  const place =
    scope.place && scope.placeIsCurrent
      ? (world.places.find((p) => p.id === scope.place?.id) ?? null)
      : null;
  // A VIEWER SEES THE PERSON AND THE MONEY, NOT THE PLACE. `pagesForAccess` is
  // all-or-nothing and this page is no longer one of its pages, so the role
  // check is written out here rather than ridden off a page list.
  const canSeePlace = place !== null && place.myRole !== "viewer";

  const members = place
    ? listFor(MEMBERS.filter((m) => m.placeId === place.id), scenario)
    : [];
  const canManage = place?.myRole === "owner";
  const groups = place ? stateGroups(place, world.profiles[place.id]) : [];

  return (
    <>
      {/* ── YOU ──────────────────────────────────────────────────────────
          ONE CARD, rows divided by hairlines — not three cards with gaps.
          Three bordered boxes say the rows are unrelated; they are one scope,
          read top to bottom. `divide-y` needs the rows to be DIRECT children
          of the card, which is why nothing here wraps them.

          FULL WIDTH. The console is fluid and this caps nothing: "one column"
          means one FULL WIDTH column, and adding a max-width back has been the
          same mistake twice. */}
      <div className={SCOPE_CARD_CLASS}>
        <div className={SCOPE_ROW_CLASS}>
          <span
            aria-hidden
            className={cn(
              SCOPE_CHIP_CLASS,
              "bg-foreground text-paper flex items-center justify-center",
            )}
          >
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={TINY_LABEL_CLASS}>You</p>
            <p className="font-display truncate text-lg font-semibold tracking-tight">
              {viewer.name}
            </p>
            <p className="text-muted-foreground truncate text-[12px]">
              {viewer.email}
            </p>
          </div>
          <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
            Edit
          </button>
        </div>

        {/* THE PORTFOLIO AS A COUNT, NOT A LIST OF DOORS. The catalogue is the
            surface that has done the switching since MESITA-1918. */}
        <div className={SCOPE_ROW_CLASS}>
          <span
            aria-hidden
            className={cn(
              SCOPE_CHIP_CLASS,
              "bg-muted text-muted-foreground flex items-center justify-center",
            )}
          >
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={TINY_LABEL_CLASS}>Places you hold</p>
            <p className="font-display truncate text-lg font-semibold tracking-tight">
              {world.viewerError ? "—" : world.places.length}
            </p>
            <p className="text-muted-foreground truncate text-[12px]">
              {world.viewerError
                ? "Could not be read. Nothing has been established about what you hold."
                : world.places.length === 0
                  ? "None yet."
                  : world.places.map((p) => p.name).join(" · ")}
            </p>
          </div>
          <Link href={SHELL_ROUTES.places} className={GHOST_PILL_BUTTON_CLASS}>
            All places
          </Link>
        </div>

        {/* THE EXIT, AND THE REASON THIS PAGE IS THE RAIL'S PINNED FOOT. It
            renders in all four rail shapes because nothing above it needed a
            place to resolve. */}
        <div className={SCOPE_ROW_CLASS}>
          <span
            aria-hidden
            className={cn(
              SCOPE_CHIP_CLASS,
              "bg-muted text-muted-foreground flex items-center justify-center",
            )}
          >
            <LogOut className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={TINY_LABEL_CLASS}>Session</p>
            <p className="font-display truncate text-lg font-semibold tracking-tight">
              Since {day(viewer.joinedAt)}
            </p>
            <p className="text-muted-foreground truncate text-[12px]">
              There is no session here to end.
            </p>
          </div>
          {/* `SignOutButton`'s real twin is a full-width pill by DEFAULT; in a
              compact slot it has to be told otherwise or it silently becomes a
              56px bar across the row. A ghost pill here, because three rows at
              one rank must not carry three shapes. */}
          <button type="button" disabled className={GHOST_PILL_BUTTON_CLASS}>
            Sign out
          </button>
        </div>
      </div>

      {/* ── BILLING ──────────────────────────────────────────────────────
          WHAT YOU PAY MESITA, and nothing else. The Membership is a fact about
          this place, so it needs one — but it is money going OUT, which is why
          it sits with the person rather than in the place's states below.

          PAYOUTS ARE NOT HERE ON PURPOSE. A guest's card money lands in the
          place's own Stripe account and is read on Online Payments. One screen
          holding both is how "Mesita never holds your money" stops being
          legible to the person paying for it. */}
      {place && (
        <Section
          title="Billing"
          description="What you pay Mesita. Your payouts are on Online Payments, in your own Stripe account."
          lane
        >
          <ul className="flex flex-col">
            <li className="border-border/60 flex min-w-0 items-center gap-3 border-b py-3">
              <div className="min-w-0 flex-1">
                <p className={TINY_LABEL_CLASS}>Mesita Membership</p>
                <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
                  A yearly fee per place. It is what makes this place a Mesita
                  Partner and unlocks Visit Rewards, Online Payments and Prepaid
                  Credits.
                </p>
              </div>
              <Badge tone={place.partnered ? "on" : "off"}>
                {MEMBERSHIP_STATE_LABEL[place.membership]}
              </Badge>
            </li>
            <li className="flex min-w-0 items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className={TINY_LABEL_CLASS}>Platform fee</p>
                <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
                  Charged on card payments taken through Online Payments, on top
                  of Stripe&apos;s own. A place that only wants demand never pays
                  it.
                </p>
              </div>
              <Badge tone={place.pay === "enabled" ? "on" : "off"}>
                {place.pay === "enabled" ? "In force" : "Not charged"}
              </Badge>
            </li>
          </ul>
        </Section>
      )}

      {/* ── THIS PLACE ───────────────────────────────────────────────────
          Everything below needs a place AND a role above viewer. With neither,
          the page is the two sections above and stops — which is the honest
          shape for somebody who holds nothing. */}
      {!canSeePlace && (
        <p className={INFO_BOX_CLASS}>
          {world.viewerError
            ? "Your places could not be read, so there is nothing here to configure."
            : world.places.length === 0
              ? "Claim a place and its team, its developers and its states appear here."
              : place === null
                ? "Open a place and its settings appear here."
                : "Your role on this place is viewer, which cannot see its settings."}
        </p>
      )}

      {canSeePlace && place && (
        <>
      <Section
        title="Team"
        description="Who can see and change this place. An owner can do everything, an editor everything but the team, a viewer nothing but look."
        right={canManage && <button type="button" className={PILL_BUTTON_CLASS}>Invite</button>}
        lane
      >
        {members.length === 0 ? (
          <EmptyState title="Nobody here" hint="Not even you, which should be impossible." />
        ) : (
          <ul className="flex flex-col gap-3">
            {members.map((m) => (
              <li key={m.id} className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                >
                  {m.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{m.name}</p>
                  <p className="text-muted-foreground truncate text-[11px]">{m.email}</p>
                </div>
                <Badge tone={m.role === "owner" ? "gold" : "neutral"}>{m.role}</Badge>
                {m.state === "invited" && <Badge tone="soon">invited</Badge>}
                {canManage && m.name !== "You" && (
                  <button type="button" aria-label={`Remove ${m.name}`} title={`Remove ${m.name}`} className={ICON_BUTTON_CLASS}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!canManage && (
          <p className={INFO_BOX_CLASS}>
            Only an owner can change the team. You hold this place as {place.myRole}.
          </p>
        )}
      </Section>

      <Section
        title="Developers"
        description="Keys for reading this place's own data. They are scoped to this place and to nothing else."
        right={canManage && <button type="button" className={GHOST_PILL_BUTTON_CLASS}>New key</button>}
        lane
      >
        <div className="border-border rounded-xl border px-3 py-2.5">
          <p className={TINY_LABEL_CLASS}>Place id</p>
          <p className="font-mono text-[12px] break-all">{place.id}</p>
        </div>
        <p className={INFO_BOX_CLASS}>
          No keys have been minted for this place. A key is shown once, when it
          is created, and never again — there is nowhere to go and look one up.
        </p>
      </Section>

          {groups.map((group) => (
            <Section
              key={group.title}
              title={group.title}
              description={group.description}
              lane
            >
              <StateList rows={group.rows} />
            </Section>
          ))}
        </>
      )}
    </>
  );
}

/** One group's rows. Lifted out of the page when the single States card became
 *  three (MESITA-1945) — three copies of this markup is how the three boxes
 *  start disagreeing about what a row looks like. */
function StateList({ rows }: { rows: StateRow[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li
          key={row.label}
          className="border-border/60 grid gap-x-5 gap-y-1.5 border-b py-3 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)]"
        >
          <div className="min-w-0">
            <p className={TINY_LABEL_CLASS}>{row.label}</p>
            <p className="text-muted-foreground mt-0.5 max-w-[52ch] text-[12px] leading-snug">
              {row.note}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-1.5">
            {row.options.map((option) => {
              const here = option === row.current;
              return (
                <Badge key={option} tone={here ? "on" : "off"}>
                  {option}
                  {/* The fill is the whole signal for the eye, and a
                      screen reader gets none of it. */}
                  {here && <span className="sr-only"> — this place</span>}
                </Badge>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}
