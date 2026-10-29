import { PlanFromProfile } from "./PlanFromProfile";

// /me/plan — the plan you are on, Free or Pro (MESITA-2134, MESITA-2553).
// It reads the profile the shell already holds (MESITA-3014).
export const dynamic = "force-dynamic";

export default function Page() {
  return <PlanFromProfile />;
}
