import { TiersClient } from "../TiersClient";

// Tiers — the four (strategy × context) ladders. Config state lives in the
// layout (PromosState), so this page is purely the view.
export default function PromosTiersPage() {
  return <TiersClient />;
}
