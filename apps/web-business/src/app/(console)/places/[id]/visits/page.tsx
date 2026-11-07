import { OperationsPage } from "@/components/place-manage/OperationsPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visits" };

// Visits (MESITA-3301): a visit is a guest paying here with Mesita (MESITA-3272
// W2). The MESITA-3202 log of QR visits left with the discounts (MESITA-3299);
// this page stands before any place takes payments and fills when they do.
export default async function VisitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <OperationsPage
      placeId={id}
      chartLine="Every visit."
      rows={[
        { name: "Visits", line: "Each time a guest paid here with Mesita." },
        { name: "Guests", line: "Different guests who came." },
      ]}
      logLine="Who came, when, and what they paid."
      empty="No visits yet. A visit is a guest paying here with Mesita."
    />
  );
}
