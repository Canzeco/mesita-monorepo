import { redirect } from "next/navigation";

// v10 (MESITA-644): the Cards tab folded into the Subscores tab's playground.
// Old links land there.
export default function ScoringCardsRedirect() {
  redirect("/scoring-config/subscores");
}
