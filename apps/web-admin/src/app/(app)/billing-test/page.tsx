import { PageContainer, PageHeader } from "@/components/PageContainer";
import { BillingTestClient } from "./BillingTestClient";

// Billing Test — Testing section. Probes each paid third-party API on its own
// so an outage can be attributed to a vendor rather than inferred from a
// degraded pipeline. Nothing is fetched on load: the operator presses the
// button, and that one button runs every vendor — two of them bill a token per
// run, which is not worth a second button or a split UI.
export const dynamic = "force-dynamic";

export default function BillingTestPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Testing · Vendors"
        title="Billing Test"
        description="One card per paid API, probed in isolation: is the key configured, does the vendor still accept it, and what is left on the balance. Mesita's pipelines fan out across several vendors at once and the Firecrawl leg fails silently, so a single degraded run can't tell you who went dark — this can."
      />
      <div className="mt-6 sm:mt-8">
        <BillingTestClient />
      </div>
    </PageContainer>
  );
}
