import { permanentRedirect } from "next/navigation";

// Verification lives on Intake (MESITA-1788). The route survives as a
// redirect: Notion's Configs registry links it, and those links are external
// and ungreppable.
export default function VerificationConfigPage(): never {
  permanentRedirect("/enricher-config#s-verification");
}
