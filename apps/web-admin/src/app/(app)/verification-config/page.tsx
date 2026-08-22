import { permanentRedirect } from "next/navigation";

// Verification folded into General (MESITA-1175). The route survives as a
// redirect: Notion's Configs registry links it, and those links are external
// and ungreppable.
export default function VerificationConfigPage(): never {
  permanentRedirect("/general-config");
}
