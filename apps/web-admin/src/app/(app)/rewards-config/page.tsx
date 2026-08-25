import { TiersClient } from "./TiersClient";
import { PromosDistributionClient } from "./PromosDistributionClient";
import { PromosSaveFooter } from "./PromosSaveFooter";

// Promos Config — one page: visit knobs, Save, then the visit-spread
// simulator. Old /tiers and /distribution URLs redirect here.
export default function PromosConfigPage() {
  return (
    <>
      <TiersClient />
      <PromosSaveFooter />
      <div className="mt-8 sm:mt-10">
        <PromosDistributionClient />
      </div>
    </>
  );
}
