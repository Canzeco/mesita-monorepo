// Place — one address, one page: Profile, Services, Status as sections.
import { notFound } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { DataRow, RungBadge, StatePill } from "@/components/console/badges";
import { getOrg, getPlace } from "@/lib/mock";
import type { PlaceServices } from "@/lib/model/types";

const SERVICE_LABEL: Record<keyof PlaceServices, string> = {
  reservations: "Reservations",
  pickup: "Pickup (prepaid)",
  delivery: "Delivery (prepaid)",
  acceptsCards: "Accepts cards",
  acceptsCredits: "Accepts Credits",
  sellsCreditsCash: "Sells Credits in cash",
};

export default async function PlacePage({
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

  return (
    <>
      <header className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {place.name}
        </h1>
        <RungBadge
          rung={
            data.organization.rung === "partner"
              ? "partner"
              : place.verified
                ? "verified"
                : "listed"
          }
        />
      </header>

      <Section title="Profile" description="What guests see on the map.">
        <div>
          <DataRow label="Address">{place.address}</DataRow>
          <DataRow label="Phone">{place.phone}</DataRow>
          <DataRow label="Hours">{place.hours}</DataRow>
        </div>
      </Section>

      <Section
        title="Services"
        description="What this address does. Pricing lives on the Organization."
      >
        <div className="flex flex-col">
          {(Object.keys(SERVICE_LABEL) as (keyof PlaceServices)[]).map((k) => (
            <div
              key={k}
              className="border-border/60 flex items-center justify-between border-b py-2.5 text-sm last:border-b-0"
            >
              <span>{SERVICE_LABEL[k]}</span>
              {place.services[k] ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                  <Check className="h-4 w-4" /> On
                </span>
              ) : (
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Minus className="h-4 w-4" /> Off
                </span>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Status" description="Where this place stands.">
        <div>
          <DataRow label="Verified">
            {place.verified ? `Yes · ${place.verifiedAt}` : "Not yet"}
          </DataRow>
          <DataRow label="Organization payments">
            <StatePill state={data.paymentAccount.state} />
          </DataRow>
        </div>
      </Section>
    </>
  );
}
