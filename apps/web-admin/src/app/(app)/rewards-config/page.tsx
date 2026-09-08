import { TiersClient } from "./TiersClient";
import { DiscountCapClient } from "./DiscountCapClient";
import { PromosSaveFooter } from "./PromosSaveFooter";
import { PromosSuperBox } from "./PromosSuperBox";

// Rewards Config — ONE page, two super boxes then Save. Old /tiers and
// /distribution URLs redirect here. No tab strip.
//
// An "Expected Distribution" box sat at the bottom until 2026-09-08
// (MESITA-1705): an assumptions-based spread simulator plus a Calculator that
// added up one guest's visit bill. Both were removed — the console shows the
// rates a place is paid, not a forecast of them, and the forecast's inputs
// were operator guesses that read as data. `distribution-model.ts`,
// `PromosDistributionClient` and `ResolvedLedger` went with it; the business
// console keeps its own distribution model, which is now the only copy.
export default function PromosConfigPage() {
  return (
    <div className="flex flex-col gap-8">
      <PromosSuperBox
        title="Strategies"
        subtitle="A place picks one column. That column is the whole program."
      >
        <TiersClient />
      </PromosSuperBox>
      <PromosSuperBox
        title="Discount Cap"
        subtitle="First N pesos of a visit bill. Platform fallback — a place cap wins when set."
      >
        <DiscountCapClient />
      </PromosSuperBox>
      <PromosSaveFooter />
    </div>
  );
}
