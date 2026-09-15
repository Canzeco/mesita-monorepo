// Orders — pickup and delivery, the two channels one card sells as one
// product. They were two rows inside Capabilities; an operator thinks
// "orders", so the two rows are one room (MESITA-1885).
//
// The gate is Capabilities' gate unchanged: a viewer may read the place,
// never configure it. `PlaceTabGate` enforces it from the matrix the layout
// already resolved (MESITA-1875).
import { ProductLadderTab } from "@/components/place-manage/ProductLadderTab";

export default function OrdersPage() {
  return <ProductLadderTab zone="orders" />;
}
