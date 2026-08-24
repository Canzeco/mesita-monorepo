import { permanentRedirect } from "next/navigation";

// Ojo policy lives on Visits (Pato, 2026-08-24) — who reads the proof is
// part of THE TICKET, not a General leftover. The route survives as a
// redirect: Notion's Configs registry and old bookmarks still link it.
// Blob, EFs and this folder stay ojo_config / admin-web-*-ojo-config.
export default function OjoConfigPage(): never {
  permanentRedirect("/visits-config");
}
