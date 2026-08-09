import { permanentRedirect } from "next/navigation";

// Retired Lineup Config subpaths → live homes. Required `[...slug]` so the
// index `page.tsx` (→ /config) and live `config/` + `playground/` routes win.
// `lanes/LanesPanel.tsx` stays as a module import for Config — only its
// redirect page is removed.
export default async function LineupConfigLegacyRedirect({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const head = slug[0];

  if (head === "memo") {
    permanentRedirect("/memo-config");
  }
  if (head === "card" || head === "cards" || head === "internals") {
    permanentRedirect("/lineup-config/playground");
  }
  if (head === "decks" || head === "engines") {
    // Historical hop: decks/engines → /lanes (which itself redirects to config).
    permanentRedirect("/lineup-config/lanes");
  }
  // lanes | params | scores | subscores | anything else → Config
  permanentRedirect("/lineup-config/config");
}
