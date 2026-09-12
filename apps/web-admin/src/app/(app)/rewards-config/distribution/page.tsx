import { permanentRedirect } from "next/navigation";

// Bookmarks to the old Distribution tab land on Visits, where Visits Rewards lives.
export default function PromosDistributionRedirect(): never {
  permanentRedirect("/visits-config");
}
