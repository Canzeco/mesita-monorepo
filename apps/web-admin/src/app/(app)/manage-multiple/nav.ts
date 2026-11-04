import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr";

// Manage › Multiple Places — the bulk tool: Google Search · Mesita Search ·
// Create · Enrich · Update over a pasted list of Google Place IDs. The qualifier came back with
// MESITA-2084 (Pato: "Multiple Places / Single Place"), when Single Place
// returned as its one-place sibling. THE ROUTE IS FROZEN at /manage-multiple:
// a rename never reaches a URL.
export const MULTIPLE_PLACES_PARENT = {
  href: "/manage-multiple",
  label: "Multiple Places",
  Icon: BuildingsIcon,
} as const;
