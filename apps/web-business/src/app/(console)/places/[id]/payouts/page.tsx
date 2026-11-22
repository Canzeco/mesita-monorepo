import { PayoutsPage } from "@/components/place-manage/MonitorPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payouts" };

// Payouts (MESITA-4679): money Stripe sent to the place's bank.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayoutsPage placeId={id} />;
}
