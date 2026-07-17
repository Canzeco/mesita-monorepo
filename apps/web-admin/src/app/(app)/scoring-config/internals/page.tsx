import { redirect } from "next/navigation";

// v10 (MESITA-644): internals live in the Subscores tab's playground.
export default function ScoringInternalsRedirect() {
  redirect("/scoring-config/subscores");
}
