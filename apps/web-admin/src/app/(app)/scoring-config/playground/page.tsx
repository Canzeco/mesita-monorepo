import { redirect } from "next/navigation";

// The old /playground split into Internals + Engines (MESITA-617), which
// became the Card Sim + Deck Sim in v9 (MESITA-620). Old links land on the
// Card Sim.
export default function ScoringPlaygroundRedirect() {
  redirect("/scoring-config/card");
}
