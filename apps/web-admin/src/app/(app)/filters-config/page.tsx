import { redirect } from "next/navigation";
import { DISCOVERY_MATRIX_HREF } from "./nav";

// Discovery index — the sidebar row. Matrix is the default section: it is
// the map of how modes, sources and signals relate, so it reads first.
export default function DiscoveryIndex() {
  redirect(DISCOVERY_MATRIX_HREF);
}
