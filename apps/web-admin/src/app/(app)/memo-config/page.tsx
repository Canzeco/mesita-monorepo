import { redirect } from "next/navigation";

// Memo Config moved into the scoring system (Memo is one of the three scoring
// engines) — keep the old URL alive.
export default function LegacyMemoConfigRedirect() {
  redirect("/scoring-config/memo");
}
