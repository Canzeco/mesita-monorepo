import { redirect } from "next/navigation";

// The old /playground split into Internals + Engines (MESITA-617) → Card Sim
// + Deck Sim (MESITA-620) → the Cards + Decks tabs (MESITA-621). Old links
// land on Cards.
export default function ScoringPlaygroundRedirect() {
  redirect("/scoring-config/cards");
}
