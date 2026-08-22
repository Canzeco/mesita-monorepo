import { permanentRedirect } from "next/navigation";

// Ojo folded into General (MESITA-1178) — three controls do not earn a rail
// row. The route survives as a redirect: Notion's Configs registry links it.
export default function OjoConfigPage(): never {
  permanentRedirect("/general-config");
}
