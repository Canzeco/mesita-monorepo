import { Building } from "lucide-react";

// Manage › Single Place — one place at a time: find it by Google Place ID or
// by name, read its facts and its Crenup ladder, run the Crenup buttons on
// it, and open its editor at /manage-single/<id>. It is NOT the per-place
// editor MESITA-1588 deleted: the editor is the business console's place
// surface (MESITA-2086), and since MESITA-2089 deleted web-business this is
// the only place it renders. Route mirrors its sibling: /manage-multiple ·
// /manage-single.
export const SINGLE_PLACE_PARENT = {
  href: "/manage-single",
  label: "Single Place",
  Icon: Building,
} as const;
