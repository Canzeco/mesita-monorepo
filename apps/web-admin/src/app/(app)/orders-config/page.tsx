import { ShoppingBag } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";

// Orders — EMPTY on purpose (Pato, 2026-08-21). The census found 11 controls,
// ZERO enforced: there is no orders table, no order EF and no consumer type,
// so every switch here configured a rail that does not exist. Three of them
// were dead outright — the channels trio modelled a delivery-app handoff the
// consumer app has already ruled out in code.
//
// The BLOB IS UNTOUCHED: orders_config, its normalizer and its EFs stay, so
// nothing is lost and nothing can be overwritten while no client renders.
// What an order will be lives in Notion Docs › Orders.
export const dynamic = "force-dynamic";

export default function OrdersConfigPage() {
  return (
    <ConfigSoon
      Icon={ShoppingBag}
      title="Orders is coming soon"
      body="Rewarding a guest who never walks in is the second context Mesita prices, and it has no rail yet — no order ticket, no EF, no consumer type. Nothing to configure until one exists."
      doc="Notion Docs › Orders"
    />
  );
}
