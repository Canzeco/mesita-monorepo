import { redirect } from "next/navigation";

// Bookmarks to the old Distribution tab land on the one Promos Config page.
export default function PromosDistributionRedirect() {
  redirect("/rewards-config");
}
