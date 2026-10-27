import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { getApifyUsage } from "./actions";
import { ApifyUsagePanel } from "./ApifyUsagePanel";
import { BillingTestClient } from "./BillingTestClient";

// Billing Test — Testing section. Probes each paid third-party API on its own
// so an outage can be attributed to a vendor rather than inferred from a
// degraded pipeline. The probes wait for the button: that one button runs
// every vendor — two of them bill a token per run, which is not worth a second
// button or a split UI. Apify's spend and run health (MESITA-2852) loads on
// open: it only reads runs Apify already billed.
export const dynamic = "force-dynamic";

export default async function BillingTestPage() {
  const apify = await getApifyUsage(30);
  return (
    <ConfigPageLayout
      eyebrow="Testing · Vendors"
      title="Billing Test"
      description="One card per paid API, probed in isolation: is the key configured, does the vendor still accept it, and what is left on the balance. Mesita's pipelines fan out across several vendors at once and the Firecrawl leg fails silently, so a single degraded run can't tell you who went dark — this can."
    >
      <div className="flex flex-col gap-6">
        <BillingTestClient />
        <ApifyUsagePanel initial={apify} />
      </div>
    </ConfigPageLayout>
  );
}
