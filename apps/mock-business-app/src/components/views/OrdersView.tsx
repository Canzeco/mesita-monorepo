"use client";

// Orders — pickup and delivery. Prepaid, always: the order is paid when it is
// placed, which is what makes a no-show cost the guest and not the kitchen.
//
// ── THE FOUR BANDS (MESITA-2002) ──────────────────────────────────────────
//
// This is the FIRST Setup pane built to the spine, and the spine is the point:
// every product's Manage half answers the same four questions in the same
// order, so the tenth pane is a fill-in rather than a design problem.
//
//   SWITCH   Is it on here, what does it cost, and can I stop it RIGHT NOW
//   RULES    The numbers and choices that change what the product does
//   SURFACE  What the guest actually sees
//   WHO      Which staff may operate it
//
// Before this, Orders' entire Manage half was one card called `Channels`
// holding two badges and a ghost button, which is why the inventory found
// that of twelve rows on Setup only about two and a half were setup.
//
// PAUSE IS WHY THE SWITCH BAND IS FIRST AND LOUD. "Stop taking orders now" is
// the most-pressed control this product will ever have — 8pm on a Friday, the
// kitchen is under — and until now there was nowhere to press it. The thing
// an operator reached for instead was a CHANNEL toggle, which is a
// configuration change used to solve an operational problem: it survives the
// night, it survives the week, and nobody remembers to undo it.
//
// WHO IS A STATED ABSENCE. There is no per-product permission model anywhere
// in this app — every product assumes owner-or-editor and says so nowhere.
// The band says it in one sentence. `ProductPane` already holds the rule: a
// stated absence is a design; an empty panel is not, and a fake form for
// something that does not exist is worse than either.
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { SoonStrip } from "@/components/shared/SoonStrip";
import { MenuDoor } from "@/components/shared/MenuDoor";
import { Rule, RULES_CARD } from "@/components/shared/Rule";
import { ErrorNote } from "@/components/ErrorNote";
import { ORDERS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import {
  ORDER_CHANNELS,
  ORDER_CHANNEL_LABEL,
  type MockOrder,
  type OrderChannelState,
} from "@/mock/types";
import { productKeyHref } from "@/lib/product-routes";
import { dayTime, money } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, INPUT_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";

const STATE_TONE: Record<MockOrder["state"], "live" | "soon" | "bad" | "neutral"> = {
  placed: "soon",
  preparing: "soon",
  ready: "live",
  collected: "live",
  canceled: "bad",
};

/** EVERY CHANNEL STATE, and the ONE thing to do about it (MESITA-2017).
 *  Exhaustive by type. `connecting` and `connected` have no door because
 *  there is nothing to press; the two failures do, and the second cannot
 *  happen in v1 — connections are platform-owned until Mesita-owned menu sync
 *  exists — so its copy is written for the day it can. */
export const CHANNEL_STATES: Record<
  OrderChannelState,
  { label: string; tone: "off" | "soon" | "live" | "bad"; verb: string | null; why: string | null }
> = {
  disconnected: { label: "Off", tone: "off", verb: "Connect", why: null },
  connecting: { label: "Connecting", tone: "soon", verb: null, why: null },
  connected: { label: "Connected", tone: "live", verb: null, why: null },
  token_expired: {
    label: "Reconnect",
    tone: "bad",
    verb: "Reconnect",
    why: "The platform dropped the connection — usually a password change on their side. Orders from it stopped arriving here.",
  },
  catalog_conflict: {
    label: "Pick an owner",
    tone: "bad",
    verb: "Pick an owner",
    why: "Both sides claim the menu. Choose whether the platform or Mesita owns it; the other stops publishing.",
  },
};

export function OrdersView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  const rows = listFor(ORDERS.filter((o) => o.placeId === place.id), scenario);

  const channelsOff = ORDER_CHANNELS.every((ch) => place.orderChannels[ch] !== "connected");
  const cfg = place.orders;

  const columns: Column<MockOrder>[] = [
    { key: "guest", head: "Guest", cell: (o) => <span className="font-medium">{o.guest}</span> },
    { key: "at", head: "Placed", cell: (o) => <span className="text-muted-foreground">{dayTime(o.at)}</span> },
    { key: "channel", head: "Channel", cell: (o) => <Badge>{o.channel}</Badge> },
    { key: "items", head: "Items", align: "right", cell: (o) => o.items },
    { key: "total", head: "Paid", align: "right", cell: (o) => <span className="font-semibold">{money(o.totalCents)}</span> },
    { key: "state", head: "State", cell: (o) => <Badge tone={STATE_TONE[o.state]}>{o.state}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
        <MenuDoor place={place} reads="Online Orders" />
        {place.orderChannels.rappi === "token_expired" && (
          <ErrorNote
            className="mt-0"
            message="Rappi stopped sending orders."
            cause={CHANNEL_STATES.token_expired.why ?? undefined}
            action={{ label: "Reconnect Rappi", href: productKeyHref(place.id, "products", "orders") }}
          />
        )}
        {/* ── SWITCH ──────────────────────────────────────────────────── */}
        <Section
          title={
            <span className="flex items-center gap-2">
              Taking orders
              {cfg?.paused ? (
                <Badge tone="off">Paused</Badge>
              ) : channelsOff ? (
                <Badge tone="off">No channel on</Badge>
              ) : (
                <Badge tone="live">Accepting</Badge>
              )}
            </span>
          }
          description={
            cfg?.paused
              ? "Nothing new can arrive until you start again. Orders already placed still have to be finished."
              : channelsOff
                ? "No channel is connected, so there is nothing for a guest to place. That is a setting, not a pause — connect a channel below."
                : "Guests can place an order right now. Pause stops that within seconds and changes nothing you have set."
          }
          lane
          right={
            <button
              type="button"
              className={`${GHOST_PILL_BUTTON_CLASS} self-start`}
              disabled={channelsOff}
            >
              {cfg?.paused ? "Start taking orders" : "Pause orders"}
            </button>
          }
        >
          <p className="text-muted-foreground text-[12px] leading-snug">
            Online Orders is on this place, carried by Mesita Pro. Pausing is
            for tonight; turning the product off is for good.
          </p>
        </Section>

        {/* ── RULES ───────────────────────────────────────────────────── */}
        <Section
          title="Rules"
          description="What a guest is offered, and what it costs them."
          lane
          right={
            <button type="button" className={`${GHOST_PILL_BUTTON_CLASS} self-start`}>
              Change rules
            </button>
          }
        >
          {cfg === null ? (
            <EmptyState
              title="Orders have never been set up here"
              hint="Connect a channel and set a prep time and this place can take its first order. Nothing below exists until you do."
            />
          ) : (
            <div className={RULES_CARD}>
              {/* SIX CHANNELS, ONE QUEUE (MESITA-2017). The three direct ones
                  pay Mesita through Stripe; the marketplaces collect their
                  own money and send the ticket. Each row is a connection
                  with a state, and the two failure states carry a door. */}
              {ORDER_CHANNELS.map((ch) => {
                const st = CHANNEL_STATES[place.orderChannels[ch]];
                return (
                  <Rule
                    key={ch}
                    label={ORDER_CHANNEL_LABEL[ch]}
                    note={
                      st.why ??
                      (ch === "app" || ch === "web" || ch === "whatsapp"
                        ? "Direct. Paid to you through Stripe before the kitchen starts."
                        : "Marketplace. They collect; the ticket lands here and you accept, quote a time and mark it ready.")
                    }
                    value={
                      <>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {st.verb && (
                          <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
                            {st.verb}
                          </button>
                        )}
                      </>
                    }
                  />
                );
              })}
              <Rule
                label="Prep time"
                note="Quoted to the guest when they order."
                value={`${cfg.prepMinutes} min`}
              />
              <Rule
                label="When you take them"
                note="A second set of hours is a second thing to forget on a holiday."
                value={cfg.windowNote ?? "Your opening hours"}
              />
              <Rule
                label="Minimum order"
                note="Below this the guest cannot check out."
                value={money(cfg.minimumCents)}
              />
            </div>
          )}
        </Section>

        {/* ── WHERE IT LANDS ──────────────────────────────────────────── */}
        <Section
          title="Where new orders are announced"
          description="Always here. And on one WhatsApp number per place, the same one Online Reservations uses — set it on either screen."
          lane
        >
          <div className={RULES_CARD}>
            <Rule
              label="Notifications number"
              note={place.notificationsNumber ? "New, changed and cancelled orders arrive here as structured messages." : "None yet. Until there is one, orders are only on this screen."}
              value={
                <input
                  aria-label="Notifications number"
                  defaultValue={place.notificationsNumber ?? ""}
                  placeholder="+52 81 …"
                  className={`${INPUT_CLASS} h-9 w-44`}
                />
              }
            />
          </div>
        </Section>

        {/* ── DELIVERY, NOT YET ───────────────────────────────────────── */}
        <SoonStrip title="Delivery is coming: your own couriers by WhatsApp, or Uber Direct">
          Pickup only for now — Pato, 2026-09-20: *“sólo permitir pickup al
          principio”*. When it lands, a courier never installs anything: the
          order arrives on their WhatsApp with the address, and they tap
          Picked up and Delivered from the message.
        </SoonStrip>

        {/* ── SURFACE ─────────────────────────────────────────────────── */}
        <Section
          title="What the guest sees"
          description="The same door from the app, your profile, and a scan at the table."
          lane
          right={
            <button type="button" className={`${GHOST_PILL_BUTTON_CLASS} self-start`}>
              Preview
            </button>
          }
        >
          <div className="bg-muted text-muted-foreground rounded-xl px-3 py-2.5 text-[12.5px] break-all">
            mesita.ai/{place.id.replace(/^plc_/, "")}/order
          </div>
          <p className="text-muted-foreground text-[12px] leading-snug">
            {channelsOff || cfg?.paused
              ? "The link still opens; it says this place is not taking orders right now."
              : "Live. An order placed here is paid before it reaches your kitchen."}
          </p>
        </Section>

        {/* ── WHO ─────────────────────────────────────────────────────── */}
        <Section
          title="Who can work orders"
          description="Nobody in particular, and that is the current answer rather than a missing screen."
          lane
        >
          <p className="text-muted-foreground text-[12px] leading-snug">
            Every owner and editor on this place can pause orders, change these
            rules, and mark an order ready. There is no per-product permission
            anywhere in the console yet, so a floor manager who should only
            work the queue has to be given the whole place.
          </p>
          <p className={TINY_LABEL_CLASS}>Not built</p>
        </Section>
      </Half>

      <Half label="Activity">
        {/* THE COUNTS BELONG HERE, NOT ON SETUP (MESITA-2002). This row used
            to sit above both halves, so "Orders shown" and "Open" — two
            activity counts — rendered on the Setup pane, which is the split
            MESITA-1986 drew when it moved the Bookings table off Products.
            Pickup and Delivery were the other two tiles and the Rules band
            above states them properly, so the whole row moved rather than
            half of it. */}
        <Tiles
          tiles={[
            { label: "Orders shown", value: rows.length || null },
            {
              label: "Open",
              value:
                rows.filter((o) => o.state !== "collected" && o.state !== "canceled")
                  .length || null,
            },
            {
              label: "Taking orders",
              value: cfg?.paused ? "Paused" : channelsOff ? "No" : "Yes",
            },
          ]}
        />
        <Section title="Recent orders" description="Newest first.">
          <Table
            columns={columns}
            rows={rows}
            empty={
              <EmptyState
                title="No orders yet"
                hint={
                  channelsOff
                    ? "No channel is connected, so there is nothing for a guest to place."
                    : cfg?.paused
                      ? "Orders are paused, so nothing new can arrive."
                      : "An order appears the moment a guest pays for one."
                }
              />
            }
          />
        </Section>
      </Half>
    </div>
  );
}
