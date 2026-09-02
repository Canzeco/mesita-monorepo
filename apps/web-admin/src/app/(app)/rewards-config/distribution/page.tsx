import { redirect } from "next/navigation";

// Bookmarks to the old Distribution tab land on the one Rewards Config page.
export default function PromosDistributionRedirect() {
  redirect("/rewards-config");
}
