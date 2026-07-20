import { redirect } from "next/navigation";

// 4-subpage restructure (2026-07-20): per-card internals live on the
// Playground tab now. Old links land there.
export default function ScoringCardRedirect() {
  redirect("/lineup-config/playground");
}
