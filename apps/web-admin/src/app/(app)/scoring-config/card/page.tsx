import { redirect } from "next/navigation";

// v10 (MESITA-644): per-card internals live in the Subscores tab's playground.
export default function ScoringCardRedirect() {
  redirect("/scoring-config/subscores");
}
