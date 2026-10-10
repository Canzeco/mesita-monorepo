import { ErrorNote } from "@/components/ErrorNote";
import { PlaceActivity } from "@/components/place-manage/sections/PlaceActivity";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { getManagePlace } from "@/lib/place-view";

export const dynamic = "force-dynamic";

export default async function AdminPlaceActivityPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const manage = await getManagePlace(id);
  return (
    <>
      {manage ? (
        <PlaceActivity place={manage.place} />
      ) : (
        <ErrorNote message="Couldn't load this place's numbers. Reload to try again." />
      )}
      <SoonStrip {...SOON_STRIPS.payments} />
    </>
  );
}
