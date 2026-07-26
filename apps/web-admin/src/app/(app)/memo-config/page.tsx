import { redirect } from "next/navigation";

// Memo Config parent route → default to the Config tab. Subpages: config,
// playground.
export default function MemoConfigIndex() {
  redirect("/memo-config/config");
}
