// Place › Status: the internal state in owner language — rung, payment
// account, verification. Carries the viewerRole gate from day one so the
// future auth pass only has to change who the viewer IS.
import { notFound } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { DataRow, RungBadge, StatePill } from "@/components/console/badges";
import { getOrg, getPlace } from "@/lib/mock";

export default async function PlaceStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = getOrg(sp.org);
  const place = getPlace(sp.org, id);
  if (!place) notFound();

  if (data.viewerRole !== "owner") {
    return (
      <p className="text-muted-foreground text-sm">
        Status is only visible to the owner.
      </p>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {place.name}
      </h1>
      <Section
        title="Standing"
        description="Where this place sits on the ladder."
        right={
          <RungBadge
            rung={
              data.organization.rung === "partner"
                ? "partner"
                : place.verified
                  ? "verified"
                  : "listed"
            }
          />
        }
      >
        <div>
          <DataRow label="Verified">
            {place.verified ? `Yes · ${place.verifiedAt}` : "Not yet"}
          </DataRow>
          <DataRow label="Organization payments">
            <StatePill state={data.paymentAccount.state} />
          </DataRow>
          <DataRow label="Organization RFC">{data.organization.rfc}</DataRow>
        </div>
      </Section>
    </>
  );
}
