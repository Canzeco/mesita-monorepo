import { redirect } from "next/navigation";

// v9 (MESITA-620): Engines became the Deck Sim — counts in, ordered deck
// out. Old links land there.
export default function ScoringEnginesRedirect() {
  redirect("/scoring-config/decks");
}
