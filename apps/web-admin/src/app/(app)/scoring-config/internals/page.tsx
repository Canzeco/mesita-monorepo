import { redirect } from "next/navigation";

// v9 (MESITA-620): Internals became the Card Sim — one consumer × intent ×
// place = one CARD with its four Scores. Old links land there.
export default function ScoringInternalsRedirect() {
  redirect("/scoring-config/card");
}
