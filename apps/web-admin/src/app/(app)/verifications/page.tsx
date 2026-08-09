import { AlertTriangle } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { listVerifications } from "./actions";
import { VerificationsClient } from "./VerificationsClient";

export const dynamic = "force-dynamic";

export default async function VerificationsPage() {
  const result = await listVerifications();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Units · Verification queue"
        title="Unit verification requests"
        description="Claims that need a human decision. Auto-confirm policy lives under Configs → Verification Config — when auto-confirm is on for a method, successful proofs never land here."
      />
      {!result.ok ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm sm:mt-8">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{result.error}</p>
        </div>
      ) : (
        <VerificationsClient
          initialVerifications={result.data.verifications}
        />
      )}
    </PageContainer>
  );
}
