import { PageContainer, PageHeader } from "@/components/PageContainer";
import { ErrorNote } from "@/components/ErrorNote";
import { listVerifications } from "./actions";
import { VerificationsClient } from "./VerificationsClient";
import { listPlaceClaims } from "./claims-actions";
import { ClaimsClient } from "./ClaimsClient";

export const dynamic = "force-dynamic";

export default async function VerificationsPage() {
  const [result, claimsResult] = await Promise.all([
    listVerifications(),
    listPlaceClaims(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Places · Verification queue"
        title="Place verification requests"
        description="Claims that need a human decision. Auto-confirm policy lives on General — when auto-confirm is on for a method, successful proofs never land here."
      />
      <div className="mt-6 sm:mt-8">
        {claimsResult.ok ? (
          <ClaimsClient initialClaims={claimsResult.data.claims} />
        ) : (
          <ErrorNote message={claimsResult.error} />
        )}
      </div>
      {!result.ok ? (
        <div className="mt-6 sm:mt-8">
          <ErrorNote message={result.error} />
        </div>
      ) : (
        <VerificationsClient
          initialVerifications={result.data.verifications}
        />
      )}
    </PageContainer>
  );
}
