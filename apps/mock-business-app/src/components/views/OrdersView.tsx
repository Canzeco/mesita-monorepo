"use client";

// Orders — pickup and delivery. Prepaid, always: the order is paid when it is
// placed, which is what makes a no-show cost the guest and not the kitchen.
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { ORDERS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockOrder } from "@/mock/types";
import { dayTime, money } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

const STATE_TONE: Record<MockOrder["state"], "good" | "warn" | "bad" | "neutral" | "brand"> = {
  placed: "warn",
  preparing: "warn",
  ready: "brand",
  collected: "good",
  canceled: "bad",
};

export function OrdersView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  const rows = listFor(ORDERS.filter((o) => o.placeId === place.id), scenario);

  const channelsOff = !place.pickupOrders && !place.deliveryOrders;

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
      <Tiles
        tiles={[
          { label: "Pickup", value: place.pickupOrders ? "On" : "Off" },
          { label: "Delivery", value: place.deliveryOrders ? "On" : "Off" },
          { label: "Orders shown", value: rows.length || null },
          { label: "Open", value: rows.filter((o) => o.state !== "collected" && o.state !== "canceled").length || null },
        ]}
      />

      <Section
        title="Channels"
        description="Turn a channel off and the button disappears from the guest's app. Orders already placed still have to be finished."
        lane
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone={place.pickupOrders ? "good" : "neutral"}>
            Pickup · {place.pickupOrders ? "on" : "off"}
          </Badge>
          <Badge tone={place.deliveryOrders ? "good" : "neutral"}>
            Delivery · {place.deliveryOrders ? "on" : "off"}
          </Badge>
        </div>
        {channelsOff && (
          <p className="text-muted-foreground text-[12px] leading-snug">
            Both channels are off, so nothing new can arrive. The list below is
            history.
          </p>
        )}
        <button type="button" className={`${GHOST_PILL_BUTTON_CLASS} self-start`}>
          Change channels
        </button>
      </Section>

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
                  : "An order appears the moment a guest pays for one."
              }
            />
          }
        />
      </Section>
    </div>
  );
}
