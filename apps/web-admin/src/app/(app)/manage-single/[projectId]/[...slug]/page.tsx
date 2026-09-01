import { permanentRedirect } from "next/navigation";

// Retired Manage Single place tabs. Required `[...slug]` so live place /
// promos / performance / admin (and the project index) stay authoritative.
export default async function ManageSingleLegacyTabRedirect({
  params,
}: {
  params: Promise<{ projectId: string; slug: string[] }>;
}) {
  const { projectId, slug } = await params;
  const head = slug[0];
  const base = `/manage-single/${projectId}`;

  // Settings folded into Controls (Pato live 2026-09-01) and Controls kept
  // the frozen /promos route, so the whole Settings surface — Team included —
  // lands there. `team` has redirected to Settings since its own tab retired.
  if (head === "settings" || head === "team") {
    permanentRedirect(`${base}/promos`);
  }
  if (head === "reviews" || head === "reservations") {
    permanentRedirect(`${base}/performance`);
  }
  // products | scores | scan | anything else → Place
  permanentRedirect(`${base}/place`);
}
