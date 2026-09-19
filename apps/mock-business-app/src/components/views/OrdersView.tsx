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
import { ORDERS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockOrder } from "@/mock/types";
import { dayTime, money } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";

const STATE_TONE: Record<MockOrder["state"], "live" | "soon" | "bad" | "neutral"> = {
  placed: "soon",
  preparing: "soon",
  ready: "live",
  collected: "live",
  canceled: "bad",
};

/** A SETTING AND ITS VALUE, one per line, hairline-divided inside one card —
 *  the shape Account and the Setup index both use. Not `FactRow`: that lays
 *  facts out in a wrapping row, which is right for four read-only numbers on
 *  a wide card and wrong for a list somebody scans down looking for the one
 *  they came to change. */
function Rule({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="flex min-h-12 items-center gap-4 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{label}</p>
        {note && (
          <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
            {note}
          </p>
        )}
      </div>
      <div className="shrink-0 text-[13px] font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

const RULES_CARD =
  "border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border";

export function OrdersView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  const rows = listFor(ORDERS.filter((o) => o.placeId === place.id), scenario);

  const channelsOff = !place.pickupOrders && !place.deliveryOrders;
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
                ? "Neither pickup nor delivery is on, so there is nothing for a guest to place. That is a setting, not a pause — turn a channel on below."
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
              hint="Pick a channel and a prep time and this place can take its first order. Nothing below exists until you do."
            />
          ) : (
            <div className={RULES_CARD}>
              <Rule
                label="Pickup"
                note="Guests order ahead and collect."
                value={
                  <Badge tone={place.pickupOrders ? "live" : "off"}>
                    {place.pickupOrders ? "On" : "Off"}
                  </Badge>
                }
              />
              <Rule
                label="Delivery"
                note="Guests order ahead and it is taken to them."
                value={
                  <Badge tone={place.deliveryOrders ? "live" : "off"}>
                    {place.deliveryOrders ? "On" : "Off"}
                  </Badge>
                }
              />
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
              {/* THE DELIVERY NUMBERS ONLY EXIST WHEN DELIVERY DOES. A radius
                  on a pickup-only place governs nothing, and a console that
                  shows one is inviting somebody to tune it. */}
              {place.deliveryOrders && (
                <>
                  <Rule
                    label="Delivery radius"
                    value={cfg.radiusKm === null ? "—" : `${cfg.radiusKm} km`}
                  />
                  <Rule
                    label="Delivery fee"
                    value={
                      cfg.deliveryFeeCents === null
                        ? "—"
                        : money(cfg.deliveryFeeCents)
                    }
                  />
                </>
              )}
              <Rule
                label="Minimum order"
                note="Below this the guest cannot check out."
                value={money(cfg.minimumCents)}
              />
            </div>
          )}
        </Section>

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
                    ? "Neither pickup nor delivery is on, so there is nothing for a guest to place."
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
