import { Building } from "lucide-react";

// Manage › Single Place — one place at a time: find it by Google Place ID or
// by name, read its facts and its Crenup ladder, run the Crenup buttons on
// it, and open its editor at /manage-single/<id>. It is NOT the per-place
// editor MESITA-1588 deleted: the per-place editor lives on this route
// (MESITA-2086). MESITA-2089 deleted web-business; admin is the only console
// left. Route mirrors its sibling: /manage-multiple ·
// /manage-single.
export const SINGLE_PLACE_PARENT = {
  href: "/manage-single",
  label: "Single Place",
  Icon: Building,
} as const;
