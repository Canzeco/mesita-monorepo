import { Building2 } from "lucide-react";

// Manage › Multiple Places — the bulk tool: Google Search · Mesita Search ·
// Crenup over a pasted list of Google Place IDs. The qualifier came back with
// MESITA-2084 (Pato: "Multiple Places / Single Place"), when Single Place
// returned as its one-place sibling. THE ROUTE IS FROZEN at /manage-multiple:
// a rename never reaches a URL.
export const MULTIPLE_PLACES_PARENT = {
  href: "/manage-multiple",
  label: "Multiple Places",
  Icon: Building2,
} as const;
