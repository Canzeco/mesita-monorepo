import { permanentRedirect } from "next/navigation";
import { UPRICH_PARENT } from "../nav";

// Enriching and Updating are one page, Uprich, since MESITA-3924.
export default function Page() {
  permanentRedirect(UPRICH_PARENT.href);
}
