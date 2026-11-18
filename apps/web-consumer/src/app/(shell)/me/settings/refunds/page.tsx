import { RefundsPage } from "@/components/consumer/activity/MeLists";

// /me/settings/refunds — money returned to the guest. It was Tickets' last
// tab until MESITA-4402 (Pato: "refunds as something in settings").
export const dynamic = "force-dynamic";

export default function Page() {
  return <RefundsPage />;
}
