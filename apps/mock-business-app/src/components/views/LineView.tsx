"use client";

// Answering Agent — the second number, and what it may do (MESITA-2017).
//
// Pato, 2026-09-20: a restaurant keeps the number it has and RENTS a second
// one from Mesita. That line answers calls and WhatsApp for anyone — a Mesita
// account or not — takes a booking, takes a pickup order and sends the Stripe
// link before the kitchen starts, answers the hours and the menu, and hands
// a person anything it cannot. It learns from the answer: an escalated
// question becomes a fact, pending review, and the next caller gets it
// without the escalation.
//
// ── THE LINE HAS STATES, AND THEY ARE NOT INSTANT ─────────────────────────
//
// Provisioning a Mexican number needs a regulatory bundle and registering it
// for WhatsApp needs Meta's approval, so `activating` is a real state with
// nothing to publish yet — Publish-your-number stays off the screen until a
// number exists. Voice comes up first; WhatsApp after. The gate (PC3) kept
// the one-line-per-place model and asked for a one-restaurant pilot before
// any of this provisions for real; the states are fixtures until then.
//
// THE LABEL IS THE OPERATOR'S. Outward, the line is "Pedidos y reservaciones"
// by default and never "Mesita" — a guest calling a restaurant should not be
// told they reached a platform. It is a field, not a constant.
import { useState } from "react";
import Link from "next/link";
import { Copy, Download, ExternalLink } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { MenuDoor } from "@/components/shared/MenuDoor";
import { Rule, RULES_CARD } from "@/components/shared/Rule";
import { Switch } from "@/components/shared/Switch";
import { ErrorNote } from "@/components/ErrorNote";
import { PLAN_LABEL, planAtLeast, type LineState } from "@/mock/types";
import { productKeyHref } from "@/lib/product-routes";
import {
  CTA_BUTTON_CLASS,
  GHOST_PILL_BUTTON_CLASS,
  INFO_BOX_CLASS,
  INPUT_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";

/** Every state the line can be in, with what the operator sees and the ONE
 *  thing they can do about it. Exhaustive by type; `states.test.ts` asserts
 *  every entry that names a next step names exactly one. */
export const LINE_STATES: Record<
  LineState,
  { headline: string; tone: "off" | "soon" | "live"; lede: string; verb: string | null }
> = {
  off: {
    headline: "No line yet",
    tone: "off",
    lede: "Turn it on and Mesita rents this place a second number. Your own number stays exactly where it is.",
    verb: "Turn on the Answering Agent",
  },
  activating: {
    headline: "Getting your number",
    tone: "soon",
    lede: "The number is being provisioned. Voice usually answers within the hour; WhatsApp waits on Meta's registration, which can take days. Nothing to publish until it exists.",
    verb: null,
  },
  voice: {
    headline: "Answering calls",
    tone: "live",
    lede: "Calls are answered. WhatsApp is registered and waiting on Meta; the same number picks it up the moment that clears.",
    verb: null,
  },
  full: {
    headline: "Answering calls and WhatsApp",
    tone: "live",
    lede: "One number, both ways in. Bookings and pickup orders land on their own products; anything it cannot answer goes to your notifications number.",
    verb: null,
  },
};

const MOCK_NUMBER = "+52 81 5555 0900";

export function LineView() {
  const place = useHeldPlace();
  const locked = !planAtLeast(place.plan, "ultra");
  const state = LINE_STATES[place.lineState];
  const live = place.lineState === "voice" || place.lineState === "full";
  const [label, setLabel] = useState(place.lineLabel);
  const [takesBookings, setTakesBookings] = useState(true);
  const [takesPickup, setTakesPickup] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
        {locked ? (
          <p className={INFO_BOX_CLASS}>
            Needs {PLAN_LABEL.ultra}. The Answering Agent costs Mesita per
            minute answered, which is what the top rung carries.
          </p>
        ) : (
          <>
            <MenuDoor place={place} reads="The Answering Agent" />
            <Section
              title={
                <span className="flex items-center gap-2">
                  {state.headline}
                  <Badge tone={state.tone}>{place.lineState === "off" ? "Off" : place.lineState === "activating" ? "Activating" : "On"}</Badge>
                </span>
              }
              description={state.lede}
              lane
              right={
                state.verb ? (
                  <button type="button" className={`${CTA_BUTTON_CLASS} self-start`}>
                    {state.verb}
                  </button>
                ) : undefined
              }
            >
              {live && (
                <div className="bg-muted text-muted-foreground rounded-xl px-3 py-2.5 text-[13px] font-semibold tabular-nums">
                  {MOCK_NUMBER}
                </div>
              )}
              {place.lineState === "voice" && (
                <ErrorNote
                  message="WhatsApp is not answering yet."
                  cause="Meta has the number and has not approved it. Calls work; a WhatsApp to this number gets no reply until it does."
                  className="mt-0"
                />
              )}
            </Section>

            <Section
              title="What it may take"
              description="Everything it takes lands on the product that owns it. Delivery is not here yet; the agent says so to a caller."
            >
              <div className={RULES_CARD}>
                <Rule
                  label="Bookings"
                  note="Held against Online Reservations' rules."
                  value={<Switch on={takesBookings} onChange={setTakesBookings} label="Bookings" />}
                />
                <Rule
                  label="Pickup orders"
                  note="Paid by a Stripe link on WhatsApp before the kitchen starts."
                  value={<Switch on={takesPickup} onChange={setTakesPickup} label="Pickup orders" />}
                />
                <Rule
                  label="Hours, menu, prices, where you are"
                  note="Always. Read from Profile and the published menu."
                  value={<Badge tone="on">Always</Badge>}
                />
                <Rule
                  label="Hands off to a person"
                  note={
                    place.notificationsNumber
                      ? `Anything it cannot answer goes to ${place.notificationsNumber} by WhatsApp. A call only if nobody replies.`
                      : "Set a notifications number on Online Orders or Online Reservations first."
                  }
                  value={<Badge tone="on">Always</Badge>}
                />
                <Rule
                  label="What callers hear it called"
                  note="Never “Mesita”. The default is what a guest expects a restaurant's line to be for."
                  value={
                    <input
                      aria-label="What callers hear the line called"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className={`${INPUT_CLASS} h-9 w-56`}
                    />
                  }
                />
              </div>
            </Section>

            {/* PUBLISH YOUR NUMBER, ONLY ONCE THERE IS ONE. The five doors
                open the right place to paste it; nothing here writes to Google
                or Meta on the operator's behalf in v1. */}
            {live && (
              <Section
                title="Publish your number"
                description="Google is where most people find you and call without having Mesita. Add it there as a second number — Google allows two."
              >
                <div className="flex flex-wrap gap-2">
                  <a href="https://business.google.com" target="_blank" rel="noreferrer" className={GHOST_PILL_BUTTON_CLASS}>
                    Edit Google profile <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                  <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className={GHOST_PILL_BUTTON_CLASS}>
                    Edit Facebook / Instagram <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                  <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
                    <Copy className="h-3 w-3" aria-hidden /> Copy number
                  </button>
                  <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
                    <Copy className="h-3 w-3" aria-hidden /> Copy suggested text
                  </button>
                  <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
                    <Download className="h-3 w-3" aria-hidden /> Download QR
                  </button>
                </div>
                <p className={INFO_BOX_CLASS}>
                  Suggested text: “{label || place.lineLabel}: {MOCK_NUMBER}”.
                </p>
              </Section>
            )}
          </>
        )}
      </Half>

      <Half label="Activity">
        <Tiles
          tiles={[
            { label: "Facts awaiting you", value: live ? place.lineFactsPending : null, hint: "Answers it escalated, not yet confirmed" },
            { label: "Answering", value: locked ? null : live ? (place.lineState === "full" ? "Calls + WhatsApp" : "Calls") : "Not yet" },
          ]}
        />
        <Section
          title="What it learned"
          description="A question it could not answer went to you; your reply became a fact. Confirm it and the next caller never waits."
        >
          {live && place.lineFactsPending > 0 ? (
            <div className={RULES_CARD}>
              <Rule
                label="Is there a terrace?"
                note="You said yes, by WhatsApp, two days ago. Stable — kept until you change it."
                value={<button type="button" className={GHOST_PILL_BUTTON_CLASS}>Confirm</button>}
              />
              {place.lineFactsPending > 1 && (
                <Rule
                  label="Do you take groups of twelve on Saturdays?"
                  note="You said only before 8pm. Expires in 30 days — hours change."
                  value={<button type="button" className={GHOST_PILL_BUTTON_CLASS}>Confirm</button>}
                />
              )}
            </div>
          ) : (
            <EmptyState
              title="Nothing escalated yet"
              hint={live ? "Every question it answered itself stays off this list." : "The line is not answering yet."}
            />
          )}
          <p className={TINY_LABEL_CLASS}>
            Bookings are on{" "}
            <Link href={productKeyHref(place.id, "activity", "reservations")} className="underline underline-offset-4">
              Online Reservations
            </Link>
            , orders on{" "}
            <Link href={productKeyHref(place.id, "activity", "orders")} className="underline underline-offset-4">
              Online Orders
            </Link>
          </p>
        </Section>
      </Half>
    </div>
  );
}
