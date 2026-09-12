import { permanentRedirect } from "next/navigation";

// Bookmarks to the old Tiers tab land on Visits, where Visits Rewards lives.
export default function PromosTiersRedirect(): never {
  permanentRedirect("/visits-config");
}
