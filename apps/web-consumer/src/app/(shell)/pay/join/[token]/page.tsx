import { redirect } from "next/navigation";
import { PayTabScreen } from "@/components/consumer/pay/PayTabScreen";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /pay/join/<token> — a friend's door to a split bill (MESITA-3695): the
// table's join QR. Takes the guest's share (consumer-web-join-tab) and
// becomes /pay/tab/<shareId>. Signed-out guests meet the shell's sign-in
// wall first and come back here.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const joinToken = decodeURIComponent(token);
  if (!/^[A-Za-z0-9_-]{22}$/.test(joinToken)) redirect(CONSUMER_ROUTES.pay);
  return <PayTabScreen start={{ kind: "join", joinToken }} />;
}
