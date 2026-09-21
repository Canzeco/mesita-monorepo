"use client";

// Orders — pickup and delivery. Prepaid, always: the order is paid when it is
// placed, which is what makes a no-show cost the guest and not the kitchen.
//
// ── SETUP STANDARD (MESITA-2034) ────────────────────────────────────────────
//
// THREE Groups, not six (§2's "a one-row Group must justify itself" —
// the earlier six-Group Setup half had four one-row cards, which is the
// paragraph-as-card idiom the whole standard exists to kill):
//
//   Taking orders   the state row (always first, D3) + the order link
//   Channels        the six connections, unchanged in substance
//   Rules           prep time, hours, minimum, notifications number,
//                   Delivery as a disabled Soon row, footer = who may work it
//
// THE STATE ROW READS THE BLOCKED TRUTH WHILE THE MENU NOTICE IS UP (§7).
// MenuDoor and "Accepting orders" used to be able to disagree — the door said
// nothing could be ordered while the row above it said orders were live. Now
// the state row itself reads "Waiting for the menu" and disables Pause
// whenever `menuPublishedAt` is null, so the first thing on the screen is
// never a fact the door contradicts.
import { Group } from "@/components/shared/Group";
import { Section } from "@/components/shared/Section";
import { Rule } from "@/components/shared/Rule";
import { Half } from "@/components/shared/Half";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { MenuDoor } from "@/components/shared/MenuDoor";
import { ORDERS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import {
  ORDER_CHANNELS,
  ORDER_CHANNEL_LABEL,
  type MockOrder,
  type OrderChannelState,
} from "@/mock/types";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { money } from "@/lib/format";
import { dayTime } from "@/lib/format";

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
    label: "Dropped",
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
  const menuMissing = place.menuPublishedAt === null;
  const failingChannel = ORDER_CHANNELS.find(
    (ch) => CHANNEL_STATES[place.orderChannels[ch]].tone === "bad",
  );

  const columns: Column<MockOrder>[] = [
    { key: "guest", head: "Guest", cell: (o) => <span className="font-medium">{o.guest}</span> },
    { key: "at", head: "Placed", cell: (o) => <span className="text-muted-foreground">{dayTime(o.at)}</span> },
    { key: "channel", head: "Channel", cell: (o) => <Badge>{o.channel}</Badge> },
    { key: "items", head: "Items", align: "right", cell: (o) => o.items },
    { key: "total", head: "Paid", align: "right", cell: (o) => <span className="font-semibold">{money(o.totalCents)}</span> },
    { key: "state", head: "State", cell: (o) => <Badge tone={STATE_TONE[o.state]}>{o.state}</Badge> },
  ];

  // THE STATE ROW'S FACTS, computed once so the Notice, the badge, the note
  // and the Pause button all agree (§7).
  const stateLabel = menuMissing
    ? "Waiting for the menu"
    : cfg?.paused
      ? "Paused"
      : channelsOff
        ? "No channel on"
        : "Accepting orders";
  const stateTone = menuMissing || cfg?.paused || channelsOff ? "off" : "live";
  const stateNote = menuMissing
    ? "Nothing can be ordered until the menu is published."
    : cfg?.paused
      ? "Nothing new can arrive until you start again. Orders already placed still have to be finished."
      : channelsOff
        ? "No channel is connected, so there is nothing for a guest to place. That is a setting, not a pause — connect a channel below."
        : failingChannel
          ? `Guests can place an order right now — except from ${ORDER_CHANNEL_LABEL[failingChannel]}, which dropped its connection.`
          : "Guests can place an order right now. Pause stops that within seconds and changes nothing you have set.";

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
        <MenuDoor place={place} reads="Online Orders" />

        <Group
          title="Taking orders"
          right={<button type="button" className={GHOST_PILL_BUTTON_CLASS}>Preview</button>}
        >
          <Rule
            label={stateLabel}
            note={stateNote}
            badge={<Badge tone={stateTone}>{cfg?.paused ? "Paused" : channelsOff || menuMissing ? "Off" : "Accepting"}</Badge>}
            control={{
              kind: "button",
              label: cfg?.paused ? "Start taking orders" : "Pause orders",
              disabled: channelsOff || menuMissing,
              onClick: () => {},
            }}
          />
          <Rule
            label="Order link"
            note={
              channelsOff || cfg?.paused || menuMissing
                ? "The link still opens; it says this place is not taking orders right now."
                : "Live. An order placed here is paid before it reaches your kitchen."
            }
            control={{ kind: "value", text: `mesita.ai/${place.id.replace(/^plc_/, "")}/order` }}
          />
        </Group>

        {/* NO SEPARATE BANNER (§7 Error): the failing channel's row below
            already carries a `bad` badge and its verb, and the state row
            above already folded the summary into its own note. A third
            telling of the same fact is the row-plus-banner duplication this
            standard exists to remove. */}
        <Group title="Channels" description="Where an order can come from. Direct channels pay you through Stripe; marketplaces collect and send the ticket.">
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
                badge={<Badge tone={st.tone}>{st.label}</Badge>}
                control={st.verb ? { kind: "button", label: st.verb, onClick: () => {} } : undefined}
              />
            );
          })}
        </Group>

        <Group
          title="Rules"
          description="What a guest is offered, what it costs, and where new orders are announced."
          footer="Every owner and editor can pause orders, change these rules and mark an order ready. There is no per-product permission model yet."
        >
          {cfg === null ? (
            <div className="flex min-h-[45vh] flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <p className="font-display text-sm font-semibold tracking-tight">Orders have never been set up here</p>
              <p className="text-muted-foreground max-w-[42ch] text-[12px] leading-snug">
                Connect a channel and set a prep time and this place can take its first order.
              </p>
            </div>
          ) : (
            <>
              <Rule label="Prep time" note="Quoted to the guest when they order." control={{ kind: "value", text: `${cfg.prepMinutes} min` }} />
              <Rule label="When you take them" note="A second set of hours is a second thing to forget on a holiday." control={{ kind: "value", text: cfg.windowNote ?? "Your opening hours" }} />
              <Rule label="Minimum order" note="Below this the guest cannot check out." control={{ kind: "value", text: money(cfg.minimumCents) }} />
              <Rule
                label="Notifications number"
                note={place.notificationsNumber ? "New, changed and cancelled orders arrive here as structured messages." : "None yet. Until there is one, orders are only on this screen."}
                control={{ kind: "input", value: place.notificationsNumber ?? "", onChange: () => {}, placeholder: "+52 81 …" }}
              />
              <Rule
                label="Delivery"
                note="Your own couriers by WhatsApp, or Uber Direct. Pickup only for now — Pato, 2026-09-20: “sólo permitir pickup al principio”."
                disabled
                control={{ kind: "value", text: <Badge tone="soon">Soon</Badge> }}
              />
            </>
          )}
        </Group>
      </Half>

      <Half label="Activity">
        {/* THE COUNTS BELONG HERE, NOT ON SETUP (MESITA-2002). */}
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
