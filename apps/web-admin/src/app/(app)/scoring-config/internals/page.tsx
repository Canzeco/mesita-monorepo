import { redirect } from "next/navigation";

// 4-subpage restructure (2026-07-20): subscore internals live on the
// Playground tab now. Old links land there.
export default function ScoringInternalsRedirect() {
  redirect("/scoring-config/playground");
}
