import { redirect } from "next/navigation";

// Bare /manage-multiple lands on the first tool.
export default function ManageMultipleIndex() {
  redirect("/manage-multiple/catalog");
}
