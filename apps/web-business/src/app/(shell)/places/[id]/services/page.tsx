// Place › Services: what this address DOES. Capability bits, never prices
// (prices live in Commercial, org-wide).
import { notFound } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { getPlace } from "@/lib/mock";
import type { PlaceServices } from "@/lib/model/types";

const SERVICE_LABEL: Record<keyof PlaceServices, string> = {
  reservations: "Reservations",
  pickup: "Pickup (prepaid)",
  delivery: "Delivery (prepaid)",
  acceptsCards: "Accepts cards",
  acceptsCredits: "Accepts Credits",
  sellsCreditsCash: "Sells Credits in cash at the register",
};

export default async function PlaceServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const place = getPlace(sp.org, id);
  if (!place) notFound();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {place.name}
      </h1>
      <Section
        title="Services"
        description="What this address offers. Pricing lives in Commercial, org-wide."
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
    </>
  );
}
