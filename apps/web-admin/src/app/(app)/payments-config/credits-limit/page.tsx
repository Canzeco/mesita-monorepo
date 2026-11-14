import { PageContainer, PageHeader } from "@/components/PageContainer";
import { getCreditsLimit } from "./actions";
import { CreditsLimitPanel } from "./CreditsLimitPanel";

// ADMIN › PAYMENTS › CREDITS LIMIT (Pato, 2026-11-14, MESITA-3947: "the limit
// each place can accept ... The default changes for each country/currency,
// but i also want to be able to monitor that super important"). The most
// House Credits a place may owe its guests at once; a voucher buy that would
// pass it is refused. Cashback still lands.
export const dynamic = "force-dynamic";

export default async function CreditsLimitPage() {
  const res = await getCreditsLimit();
  return (
    <PageContainer>
      <PageHeader
        title="Credits Limit"
        description="The most credit a place may owe its guests at once. A voucher buy that would pass it is refused; cashback still lands."
      />
      <div className="mt-6 sm:mt-8">
        {res.ok ? (
          <CreditsLimitPanel testMode={res.test_mode} defaults={res.defaults} places={res.places} />
        ) : (
          <p className="text-destructive text-sm" role="alert">
            Couldn&apos;t load the Credits Limit: {res.error}
          </p>
        )}
      </div>
    </PageContainer>
  );
}
