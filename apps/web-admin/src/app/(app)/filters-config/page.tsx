import { redirect } from "next/navigation";
import { DISCOVERY_TABS } from "./nav";

// Discovery index — the sidebar row. It opens the first tab.
export default function DiscoveryIndex() {
  redirect(DISCOVERY_TABS[0].href);
}
