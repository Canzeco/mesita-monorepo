import { redirect } from "next/navigation";

// 4-subpage restructure (2026-07-20): per-card simulation lives on the
// Playground tab now. Old links land there.
export default function ScoringCardsRedirect() {
  redirect("/lineup-config/playground");
}
