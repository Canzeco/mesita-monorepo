import { redirect } from "next/navigation";

// v10 (MESITA-644): engines are containers on the Scores & Lanes tab.
export default function ScoringEnginesRedirect() {
  redirect("/scoring-config/lanes");
}
