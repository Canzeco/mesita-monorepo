// Organization — the legal person, one page. Identity, then its three
// facets as calm sections: Finances, Members, Commercial. No dashboard,
// no stream: the skeleton IS the model.
import { Landmark } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataRow, RungBadge, StatePill } from "@/components/console/badges";
import { RungStrip } from "@/components/console/RungStrip";
import { formatMxn } from "@/lib/model/format";
import { getOrg } from "@/lib/mock";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = getOrg(sp.org);
  const org = data.organization;
  const pa = data.paymentAccount;
  const c = data.commercial;
  const placeName = (id: string) =>
    data.places.find((p) => p.id === id)?.name ?? id;

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {org.name}
          </h1>
          <RungBadge rung={org.rung} />
        </div>
        <RungStrip rung={org.rung} />
      </header>

      <Section title="Identity" description="One legal person, one RFC, one account.">
        <div>
          <DataRow label="Legal name">{org.legalName}</DataRow>
          <DataRow label="RFC">{org.rfc}</DataRow>
          <DataRow label="Currency">{org.currency}</DataRow>
        </div>
      </Section>

      <Section
        title="Finances"
        description="Where money lands, and the Credits it owes."
        right={<StatePill state={pa.state} />}
      >
        {pa.state === "none" ? (
          <EmptyState
            icon={<Landmark className="text-muted-foreground h-5 w-5" />}
            title="No payment account yet"
            description="Connect payments to fund rewards, sell Credits and take prepaid orders."
            action={
              <button type="button" className={CTA_BUTTON_CLASS} disabled>
                Connect payments (soon)
              </button>
            }
            className="p-6"
          />
        ) : (
          <div>
            <DataRow label="Bank">
              {pa.bank} · ···· {pa.clabeLast4}
            </DataRow>
            <DataRow label="Payouts">{pa.payoutSchedule}</DataRow>
            <DataRow label="Credits owed">
              {formatMxn(pa.creditsLiabilityCents)}
            </DataRow>
            <DataRow label="Credits bonus">
              {pa.creditsBonusPct}% one-time · {pa.creditsRecurringBonusPct}%
              recurring
            </DataRow>
            <DataRow label="Hold · expiry">
              {pa.creditsHoldHours} h · {pa.creditsExpiryDays} days
            </DataRow>
          </div>
        )}
      </Section>

      <Section
        title="Members"
        description="Roles live at the organization; scope decides which places."
      >
        <div>
          {data.members.map((m) => (
            <DataRow key={m.id} label={m.name}>
              <span className="capitalize">{m.role}</span>
              <span className="text-muted-foreground">
                {" "}
                ·{" "}
                {m.placeIds === null
                  ? "all places"
                  : m.placeIds.map(placeName).join(", ")}
              </span>
            </DataRow>
          ))}
        </div>
      </Section>

      <Section
        title="Commercial"
        description="What a guest pays — one configuration for every place."
      >
        {org.rung !== "partner" ? (
          <p className="text-muted-foreground text-sm">
            Locked at Zero until payments go live.
          </p>
        ) : (
          <div>
            <DataRow label="Aggression">
              {c.aggression}/100 · cap{" "}
              {c.discountCapMxn ? formatMxn(c.discountCapMxn * 100) : "—"}
            </DataRow>
            <DataRow label="Pass">
              {c.pass?.enabled
                ? `${formatMxn(c.pass.priceCents)} / ${c.pass.period} · +${c.pass.grantsBonusPct}% Credits`
                : "Not offered"}
            </DataRow>
            <DataRow label="Orders">
              {c.orderFees
                ? `pickup min ${formatMxn(c.orderFees.pickupMinCents)} · delivery ${formatMxn(c.orderFees.deliveryFeeCents)}, min ${formatMxn(c.orderFees.deliveryMinCents)}`
                : "Off"}
            </DataRow>
          </div>
        )}
      </Section>
    </>
  );
}
