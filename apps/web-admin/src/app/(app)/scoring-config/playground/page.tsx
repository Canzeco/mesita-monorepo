import { redirect } from "next/navigation";

// v10 (MESITA-644): each tab carries its own playground now — the Subscore
// playground on Subscores, the Deck playground on Scores & Lanes.
export default function ScoringPlaygroundRedirect() {
  redirect("/scoring-config/subscores");
}
