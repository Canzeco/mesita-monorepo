import { PassportModal } from "@/components/consumer/me/PassportModal";

// /me/passport — the document. Was a LocalSheet on the hub (MESITA-1789).
export const dynamic = "force-dynamic";

export default function Page() {
  return <PassportModal />;
}
