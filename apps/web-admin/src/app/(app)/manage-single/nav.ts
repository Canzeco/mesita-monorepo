import { Building } from "lucide-react";

// Manage › Single Place — one place at a time: find it by Google Place ID or
// by name, read its facts and its Crenup ladder, run the Crenup buttons on
// it, and step through to its editor in the business console. It is NOT
// the per-place editor MESITA-1588 deleted — that editor lives on in
// web-business at /places/[id] (MESITA-1537) and this page links to it
// rather than copying it. Route mirrors its sibling: /manage-multiple ·
// /manage-single.
export const SINGLE_PLACE_PARENT = {
  href: "/manage-single",
  label: "Single Place",
  Icon: Building,
} as const;
