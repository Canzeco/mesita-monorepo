import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { NewVisitLoading } from "./NewVisitLoading";

const NewVisitClient = nextDynamic(
  () => import("./NewVisitClient").then((mod) => mod.NewVisitClient),
  { loading: () => <NewVisitLoading /> },
);

export const dynamic = "force-dynamic";

// New Visit — the centre tab (MESITA-811 · MESITA-820): three steps + New/Pending/History;
// the venue pass modal carries the QR. Legacy /pay/* paths redirect here.
//
// No profile fetch: the page needs the user id and nothing else since the
// identity header and the member code both left (MESITA-820). Dropping it
// removes a blocking round-trip AND the failure mode where a profile-EF
// hiccup replaced the whole wallet with an error box — tickets load
// client-side and have their own retry.
export default async function NewVisitPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/?next=${encodeURIComponent(CONSUMER_ROUTES.newVisit.root)}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <NewVisitClient userId={user.id} />
    </div>
  );
}
