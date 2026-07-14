import { redirect } from "next/navigation";

// /scoring-config is tabbed — land on Params.
export default function ScoringConfigIndex() {
  redirect("/scoring-config/params");
}
