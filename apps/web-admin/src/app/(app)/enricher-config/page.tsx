import { permanentRedirect } from "next/navigation";
import { CREATION_PARENT } from "./nav";

// Bare /enricher-config is Creation now (MESITA-2083): Crenup became two rail
// rows, Creation and Enrichment, each its own page under this frozen prefix.
export default function CrenupIndex() {
  permanentRedirect(CREATION_PARENT.href);
}
