import { AlertTriangle } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { listVerifications } from "./actions";
import { VerificationsClient } from "./VerificationsClient";

export default async function VerificationsPage() {
  const result = await listVerifications();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Units · Verification queue"
        title="Unit verification requests"
        description="Businesses prove ownership via phone OTP (auto-confirmed by default, so it never lands here) or a walkthrough video (queued for review by default). Toggle either to flip the policy."
      />
      {!result.ok ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm sm:mt-8">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{result.error}</p>
        </div>
      ) : (
        <VerificationsClient
          initialVerifications={result.data.verifications}
          initialAutoVerifyAiCall={result.data.autoVerifyAiCall}
          initialAutoVerifyVideo={result.data.autoVerifyVideo}
          initialAutoVerifyUpdatedAt={result.data.autoVerifyUpdatedAt}
        />
      )}
    </PageContainer>
  );
}
