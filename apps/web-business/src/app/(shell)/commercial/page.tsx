// Commercial: everything a guest can feel in the bill, org-wide by law —
// the dial, the cap, the Pass offer, order pricing. Credits terms are NOT
// here (they live in Finances, next to the liability).
import { Percent } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataRow } from "@/components/console/badges";
import { Dial } from "@/components/console/Dial";
import { formatMxn } from "@/lib/model/format";
import { getOrg } from "@/lib/mock";

export default async function CommercialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = getOrg(sp.org);
  const c = data.commercial;
  const isPartner = data.organization.rung === "partner";

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Commercial
      </h1>
      <p className="text-muted-foreground -mt-3 text-sm">
        One configuration for every place. If it changes what a guest pays, it
        lives here.
      </p>

      {!isPartner ? (
        <EmptyState
          icon={<Percent className="text-muted-foreground h-5 w-5" />}
          title="Locked at Zero"
          description="Rewards, the Pass and order pricing unlock when payments go live — that is what Partner means."
        />
      ) : (
        <>
          <Section
            title="Rewards"
            description="One dial. Mesita owns the shape; you own the volume."
            right={
              <span className="text-muted-foreground text-[11px]">
                Cap {c.discountCapMxn ? formatMxn(c.discountCapMxn * 100) : "—"}
              </span>
            }
          >
            <Dial aggression={c.aggression} capMxn={c.discountCapMxn} />
          </Section>

          <Section
            title="Pass"
            description="Credits subscription — recurring Credits at a better bonus, billed monthly on your account."
          >
            {c.pass?.enabled ? (
              <div>
                <DataRow label="Price">
                  {formatMxn(c.pass.priceCents)} / {c.pass.period}
                </DataRow>
                <DataRow label="Grants">
                  +{c.pass.grantsBonusPct}% Credits on every refill
                </DataRow>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Not offered yet.</p>
            )}
          </Section>

          <Section
            title="Order pricing"
            description="Fees and minimums for prepaid pickup and delivery."
          >
            {c.orderFees ? (
              <div>
                <DataRow label="Pickup">
                  {c.orderFees.pickupFeeCents === 0
                    ? "No fee"
                    : formatMxn(c.orderFees.pickupFeeCents)}{" "}
                  · min {formatMxn(c.orderFees.pickupMinCents)}
                </DataRow>
                <DataRow label="Delivery">
                  {formatMxn(c.orderFees.deliveryFeeCents)} · min{" "}
                  {formatMxn(c.orderFees.deliveryMinCents)}
                </DataRow>
                <DataRow label="Free delivery over">
                  {c.orderFees.freeOverCents
                    ? formatMxn(c.orderFees.freeOverCents)
                    : "—"}
                </DataRow>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Orders are off — enable pickup or delivery on a place first.
              </p>
            )}
          </Section>
        </>
      )}
    </>
  );
}
