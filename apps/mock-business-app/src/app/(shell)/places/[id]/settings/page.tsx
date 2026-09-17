"use client";

// Settings — Team, Developers, and the states this place holds.
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
// `web-business` has no such card and this is not a snapshot of one. It does
// for ONE place what `/places` does across places — list every state this
// console can switch — because nothing on an operator's own screens ever says
// what their place IS. AdminView says some of it and is super-admin-only; the
// place heading wears two badges out of twelve facts.
//
// READ-ONLY, and that is the whole design. Every value here is set by Stripe,
// by an operator, or by the scenario panel, and none of them is set from
// Settings. Rows that looked like switches would be a second surface granting
// what one surface already grants — the mistake the Team box above names.
//
// FILL MEANS IN FORCE, NOT "ON". A place with no pickup orders shows a FILLED
// "Off": the word in the pill is the fact, and the fill only says which of the
// row's values is the live one. Every row prints all of its values, including
// the ones this place is not in, because the states nobody can reach are the
// reason this app exists.
import { X } from "lucide-react";
import { notFound } from "next/navigation";
import { NotHeld, useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/shared/Badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { MEMBERS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import {
  MEMBERSHIP_STATE_LABEL,
  PAY_LADDER_LABEL,
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
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";

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
  const onOff = (on: boolean) => (on ? "On" : "Off");
  const YES_NO = ["Yes", "No"];
  const ON_OFF = ["On", "Off"];

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
      label: "Partner",
      options: YES_NO,
      current: yesNo(place.partnered),
      note: "The place pays. This is the gate Visits, Rewards, Payments and Credits read.",
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
      note: "What the subscription is doing, which is not whether the place is a partner. Payment due still entitles.",
    },
    {
      label: "Payments",
      options: Object.values(PAY_LADDER_LABEL),
      current: PAY_LADDER_LABEL[place.pay],
      note: "This place\u2019s own Stripe account. Not set up and Restricted are different facts that Stripe reports the same way.",
    },
  ];

  const products: StateRow[] = [
    {
      label: "Customer intelligence",
      options: ["Subscribed", "Not subscribed"],
      current: place.customerIntel ? "Subscribed" : "Not subscribed",
      note: "The Customers catalog is rented, not bought. Off, the list is counted and nobody in it is named.",
    },
    {
      label: "Pickup orders",
      options: ON_OFF,
      current: onOff(place.pickupOrders),
      note: "Guests order ahead and collect.",
    },
    {
      label: "Delivery orders",
      options: ON_OFF,
      current: onOff(place.deliveryOrders),
      note: "Guests order ahead and it is taken to them.",
    },
    {
      label: "Reservations",
      options: ON_OFF,
      current: onOff(place.reservations),
      note: "Table bookings, through this place\u2019s own provider.",
    },
    {
      label: "Visit rewards",
      options: ON_OFF,
      current: onOff(place.visitRewards),
      note: "A guest earns back on what a visit cost them.",
    },
    {
      label: "Credits",
      options: ON_OFF,
      current: onOff(place.credits),
      note: "The place sells credit that guests spend here later.",
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
      title: "Product states",
      description:
        "Which of the products this place has switched on. The same six facts the catalogue states on its cards, in one list.",
      rows: products,
    },
    {
      title: "Intake states",
      description:
        "Where the Intaker got to, and what it owns. Nothing here is set by hand — the pipeline writes all of it.",
      rows: intake,
    },
  ].filter((g) => g.rows.length > 0);
}

export default function PlaceSettingsPage() {
  const place = useHeldPlaceOrNull();
  const { pages } = usePlaceScope();
  const { scenario, world } = useMock();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;
  // AND HELD AS WHAT (MESITA-1933). `NotHeld` above answers "is this place
  // held"; it has never answered the role, and until now nothing did for this
  // page — the rail's product rows were running `tabsForAccess` and that was
  // the whole console's role check. The rows are gone, so the gate is here.
  // `notFound`, like `PlaceTabGate`: a page reachable by typing its address is
  // a page, whatever the rail chose to draw.
  if (!pages.includes("settings")) notFound();

  const members = listFor(MEMBERS.filter((m) => m.placeId === place.id), scenario);
  const canManage = place.myRole === "owner";
  const groups = stateGroups(place, world.profiles[place.id]);

  return (
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
