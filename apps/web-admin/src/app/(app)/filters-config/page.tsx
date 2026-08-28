import { redirect } from "next/navigation";
import { DISCOVERY_MODES_HREF } from "./nav";

// Discovery index — the sidebar row. Modes is the default section.
export default function DiscoveryIndex() {
  redirect(DISCOVERY_MODES_HREF);
}
