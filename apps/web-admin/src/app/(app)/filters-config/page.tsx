import { redirect } from "next/navigation";

// Filters Config parent route → default to General, the tab that carries the
// law the six surface tabs inherit.
export default function FiltersConfigIndex() {
  redirect("/filters-config/general");
}
