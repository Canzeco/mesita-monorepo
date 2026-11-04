import { MeScreen } from "@/components/consumer/me/MeScreen";
import { VisitsSkeleton } from "@/components/consumer/visits/VisitsPage";

// /me/visits' fallback: the page's own frame over its rows in bones.
export default function VisitsLoading() {
  return (
    <MeScreen title="Visits" flush>
      <VisitsSkeleton />
      <p role="status" className="sr-only">
        Loading visits
      </p>
    </MeScreen>
  );
}
