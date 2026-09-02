import { TiersClient } from "./TiersClient";
import { DiscountCapClient } from "./DiscountCapClient";
import { PromosDistributionClient } from "./PromosDistributionClient";
import { PromosSaveFooter } from "./PromosSaveFooter";
import { PromosCalculator } from "./PromosCalculator";
import { PromosSuperBox } from "./PromosSuperBox";

// Rewards Config — ONE page, three super boxes. Old /tiers and /distribution
// URLs redirect here. No tab strip.
export default function PromosConfigPage() {
  return (
    <div className="flex flex-col gap-8">
      <PromosSuperBox
        title="Strategies"
        subtitle="Visit rewards only — not orders, not prepaid. A place picks one column. That column is the whole program."
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
      <PromosSuperBox
        title="Expected Distribution"
        subtitle="Assumptions, not live tickets. Calculator last — pick a guest, watch the visit bill add up."
      >
        <PromosDistributionClient />
        <PromosCalculator />
      </PromosSuperBox>
    </div>
  );
}
