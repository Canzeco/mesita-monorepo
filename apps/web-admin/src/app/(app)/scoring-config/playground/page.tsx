import { redirect } from "next/navigation";

// /scoring-config/playground split into two subpages (MESITA-617): Internals
// (n = 1 score internals) and Engines (ranked lists over the sample). Old
// links land on Internals.
export default function ScoringPlaygroundRedirect() {
  redirect("/scoring-config/internals");
}
