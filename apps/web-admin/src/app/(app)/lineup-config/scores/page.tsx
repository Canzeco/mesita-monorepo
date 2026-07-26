import { redirect } from "next/navigation";

// Retired 2026-07-26: Subscores + Scores + Lanes merged into one Config page.
export default function LineupConfigScoresRedirect() {
  redirect("/lineup-config/config");
}
