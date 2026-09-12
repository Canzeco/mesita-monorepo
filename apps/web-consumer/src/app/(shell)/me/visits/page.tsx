import { VisitsModal } from "@/components/consumer/me/ActivityModals";

// /me/visits — tickets and QRs. Was a LocalSheet (MESITA-1789).
export const dynamic = "force-dynamic";

export default function Page() {
  return <VisitsModal />;
}
