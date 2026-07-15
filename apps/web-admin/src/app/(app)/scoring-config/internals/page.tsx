import { redirect } from "next/navigation";

// v9 made Internals the Card Sim; v9.1 (MESITA-621) names it the Cards tab.
export default function ScoringInternalsRedirect() {
  redirect("/scoring-config/cards");
}
