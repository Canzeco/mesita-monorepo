import { permanentRedirect } from "next/navigation";

// General renamed to Models (MESITA-1788). The route survives as a redirect:
// Notion's Configs registry and old bookmarks still link here.
export default function GeneralConfigPage(): never {
  permanentRedirect("/models-config");
}
