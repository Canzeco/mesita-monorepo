import { redirect } from "next/navigation";

// /lineup-config is tabbed — land on Config (the whole model on one page).
export default function ScoringConfigIndex() {
  redirect("/lineup-config/config");
}
