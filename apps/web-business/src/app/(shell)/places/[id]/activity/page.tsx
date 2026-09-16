// Activity — THIS PLACE's numbers.
//
// It was a place view (`/places/<id>/activity`) from MESITA-1537, moved up to
// the organization in MESITA-1841 on Pato's 2026-09-14 drawing — *"an operator
// asking 'how are we doing' is asking about the business, not about one
// storefront"* — and comes back here in MESITA-1892 because the business IS
// the storefront now. The address it returns to is the one it started at, and
// `next.config.ts` had to DELETE the rule that forwarded it away: a config
// rule runs before filesystem routes, so leaving it would make this page
// unreachable with every check green (MESITA-1839).
//
// WHAT THE READ CAN ACTUALLY ANSWER, and why that stopped mattering.
// `business-web-get-performance` is place-scoped, which is exactly what this
// page needs — so the picker that used to sit beside the title is gone with
// the organization it existed for. One place, one set of numbers, no control.
//
// THE PAYMENTS LOG LIVES HERE (MESITA-1872). Pato: *"payments log go into
// activity."* It was the last strip on the catalogue, and it was the only
// thing on that page that was not a product: what guests paid and what reached
// the account is a READING, and this is the page an operator opens to read
// what happened. It is unbuilt, so it is a `SoonStrip` — never a fake feed and
// never a fake number.
//
// THE PAGE READS ONE THING. `getManagePlace` is request-cached and the layout
// above already paid for it, so the feed costs no extra round trip
// (MESITA-1875).
import { ErrorNote } from "@/components/ErrorNote";
import { PlaceActivity } from "@/components/place-manage/sections/PlaceActivity";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { getManagePlace } from "@/lib/place-view";

export const dynamic = "force-dynamic";

export default async function PlaceActivityPage(props: {
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
      {/* The payments log, at the foot: it is a reading of money, so it sits
          UNDER the numbers rather than above them. */}
      <SoonStrip {...SOON_STRIPS.payments} />
    </>
  );
}
