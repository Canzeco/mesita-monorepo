import { redirect } from "next/navigation";

// v10 (MESITA-644): decks became Scores & Lanes (three lanes, one merge).
// Old links land there.
export default function ScoringDecksRedirect() {
  redirect("/scoring-config/lanes");
}
