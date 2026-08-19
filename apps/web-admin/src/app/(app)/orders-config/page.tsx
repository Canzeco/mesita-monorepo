import { getOrdersConfig } from "./actions";
import { ORDERS_FALLBACK } from "./defaults";
import { OrdersConfigClient } from "./OrdersConfigClient";

// Orders Config — the remote context's policy blob.
export const dynamic = "force-dynamic";

export default async function OrdersConfigPage() {
  const res = await getOrdersConfig();
  return (
    <OrdersConfigClient
      initialConfig={res.ok ? res.config : ORDERS_FALLBACK}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
