import { redirect } from "next/navigation";

// Memo moved back out to its own section (MESITA-627) — it's a product agent,
// not a ranking tab. Keep the tab URL alive for saved links.
export default function ScoringMemoRedirect() {
  redirect("/memo-config");
}
