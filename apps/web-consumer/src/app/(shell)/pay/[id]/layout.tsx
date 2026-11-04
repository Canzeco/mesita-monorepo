import { RewardSheet } from "@/components/consumer/rewards/RewardSheet";

// The sheet sits above the step, so what the guest typed survives moving between
// /pay/<place>/bill, /reward and /qr (MESITA-3254).
export default async function PayPlaceLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  return (
    <>
      <RewardSheet placeId={id} />
      {children}
    </>
  );
}
