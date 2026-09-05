// Finances: the payment account AND the Credits terms + liability — the
// bonus you offer belongs next to the balance you owe (decided 2026-09-05:
// anything pooled is configured where it is pooled).
import { Landmark } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataRow, StatePill, StatTile } from "@/components/console/badges";
import { formatMxn } from "@/lib/model/format";
import { getOrg } from "@/lib/mock";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { paymentAccount: pa } = getOrg(sp.org);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Finances
      </h1>

      {pa.state === "none" ? (
        <EmptyState
          icon={<Landmark className="text-muted-foreground h-5 w-5" />}
          title="No payment account yet"
          description="Connect payments to fund rewards, sell Credits and take prepaid orders. RFC and CLABE required — about ten minutes."
          action={
            <button type="button" className={CTA_BUTTON_CLASS} disabled>
              Connect payments (soon)
            </button>
          }
        />
      ) : (
        <Section
          title="Payment account"
          description="Where money lands. Direct charges: your places are the merchant of record."
          right={<StatePill state={pa.state} />}
        >
          <div>
            <DataRow label="Bank">{pa.bank}</DataRow>
            <DataRow label="CLABE">···· {pa.clabeLast4}</DataRow>
            <DataRow label="Payouts">{pa.payoutSchedule}</DataRow>
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatTile
          label="Credits owed"
          value={formatMxn(pa.creditsLiabilityCents)}
          hint="what guests hold against you"
        />
        <StatTile
          label="Top-up bonus"
          value={`${pa.creditsBonusPct}% / ${pa.creditsRecurringBonusPct}%`}
          hint="one-time / monthly refill"
        />
      </div>

      <Section
        title="Credits terms"
        description="These sit next to the liability they create on purpose."
      >
        <div>
          <DataRow label="One-time bonus">{pa.creditsBonusPct}%</DataRow>
          <DataRow label="Recurring bonus (Credits subscription)">
            {pa.creditsRecurringBonusPct}%
          </DataRow>
          <DataRow label="Hold before spendable">{pa.creditsHoldHours} h</DataRow>
          <DataRow label="Expiry">{pa.creditsExpiryDays} days</DataRow>
        </div>
      </Section>
    </>
  );
}
