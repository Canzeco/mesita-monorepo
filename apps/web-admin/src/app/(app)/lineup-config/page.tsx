import { redirect } from "next/navigation";

// /lineup-config is tabbed — land on Subscores (the model's first layer).
export default function ScoringConfigIndex() {
  redirect("/lineup-config/subscores");
}
