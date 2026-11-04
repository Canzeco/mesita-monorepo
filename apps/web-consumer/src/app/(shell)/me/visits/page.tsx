import { MeScreen } from "@/components/consumer/me/MeScreen";
import { VisitsPage } from "@/components/consumer/visits/VisitsPage";

// /me/visits — Me › Visits, the guest's history (MESITA-3264), in Me's frame.
export const dynamic = "force-dynamic";
export const metadata = { title: "Visits" };

export default function Page() {
  return (
    <MeScreen title="Visits" flush>
      <VisitsPage />
    </MeScreen>
  );
}
