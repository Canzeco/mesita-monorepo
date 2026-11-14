import { permanentRedirect } from "next/navigation";
import { UPRICH_PARENT } from "../nav";

// Enriching and Updating are one page, Updation (MESITA-3924, MESITA-3934).
export default function Page() {
  permanentRedirect(UPRICH_PARENT.href);
}
