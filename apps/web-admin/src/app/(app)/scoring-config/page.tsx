import { redirect } from "next/navigation";

// /scoring-config is tabbed — land on Subscores (the model's first layer).
export default function ScoringConfigIndex() {
  redirect("/scoring-config/subscores");
}
