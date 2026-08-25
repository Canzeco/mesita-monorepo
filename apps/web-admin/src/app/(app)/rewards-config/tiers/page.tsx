import { redirect } from "next/navigation";

// Bookmarks to the old Tiers tab land on the one Promos Config page.
export default function PromosTiersRedirect() {
  redirect("/rewards-config");
}
