import { permanentRedirect } from "next/navigation";

// Visits Rewards lives on Visits (Pato, 2026-09-12) — rates a visit pays
// belong with THE TICKET, not a sibling rail row. The route survives as a
// redirect: Notion's Configs registry and old bookmarks still link it.
// Blob, EFs and this folder stay promos_config / admin-web-*-rewards-config.
export default function PromosConfigPage(): never {
  permanentRedirect("/visits-config");
}
