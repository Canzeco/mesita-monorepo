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
} from "@/mock/types";
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

function stateRows(place: MockPlace): StateRow[] {
  const yesNo = (on: boolean) => (on ? "Yes" : "No");
  const onOff = (on: boolean) => (on ? "On" : "Off");
  const YES_NO = ["Yes", "No"];
  const ON_OFF = ["On", "Off"];

  return [
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
}

export default function PlaceSettingsPage() {
  const place = useHeldPlaceOrNull();
  const { pages } = usePlaceScope();
  const { scenario } = useMock();
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
  const rows = stateRows(place);

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

      <Section
        title="States"
        description="Every state this place can be in, and the one it is in now. Read-only: these are set by Stripe, by an operator, or by the scenario panel — never from this page."
        lane
      >
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
      </Section>
    </>
  );
}
