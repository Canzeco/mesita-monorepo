import { redirect } from "next/navigation";

// Atlas Config parent route → default to the Config tab. Subpages: config,
// playground.
export default function AtlasConfigIndex() {
  redirect("/atlas-config/config");
}
