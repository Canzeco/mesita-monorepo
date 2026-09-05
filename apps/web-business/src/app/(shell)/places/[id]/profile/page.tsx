// Place › Profile: the physical facts of one address.
import { notFound } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { getPlace } from "@/lib/mock";

export default async function PlaceProfilePage({
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
      <Section title="Profile" description="What guests see on the map.">
        <div>
          <DataRow label="Address">{place.address}</DataRow>
          <DataRow label="Phone">{place.phone}</DataRow>
          <DataRow label="Hours">{place.hours}</DataRow>
        </div>
      </Section>
      <Section title="Photos & menu" description="Coming with the profile editor.">
        <p className="text-muted-foreground text-sm">
          Managed here later — the mock era is read-only.
        </p>
      </Section>
    </>
  );
}
