import { TiersClient } from "./TiersClient";
import { PromosDistributionClient } from "./PromosDistributionClient";
import { PromosSaveFooter } from "./PromosSaveFooter";
import { PromosCalculator } from "./PromosCalculator";

// Promos Config — one page: Visit Promos, Discount Cap, Save, Expected
// Distribution, Calculator last. Old /tiers and /distribution URLs redirect.
export default function PromosConfigPage() {
  return (
    <>
      <TiersClient />
      <PromosSaveFooter />
      <div className="mt-8 sm:mt-10">
        <PromosDistributionClient />
      </div>
      <div className="mt-8 sm:mt-10">
        <PromosCalculator />
      </div>
    </>
  );
}
