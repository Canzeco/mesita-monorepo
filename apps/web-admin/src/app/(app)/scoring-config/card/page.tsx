import { redirect } from "next/navigation";

// v9.1 (MESITA-621): the Card Sim is the Cards tab. Old links land there.
export default function ScoringCardRedirect() {
  redirect("/scoring-config/cards");
}
