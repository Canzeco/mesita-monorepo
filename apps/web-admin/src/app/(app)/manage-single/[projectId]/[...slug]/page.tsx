import { permanentRedirect } from "next/navigation";

// Retired Manage Single unit tabs. Required `[...slug]` so live place / promos /
// performance / settings / admin (and the project index) stay authoritative.
export default async function ManageSingleLegacyTabRedirect({
  params,
}: {
  params: Promise<{ projectId: string; slug: string[] }>;
}) {
  const { projectId, slug } = await params;
  const head = slug[0];
  const base = `/manage-single/${projectId}`;

  if (head === "team") {
    permanentRedirect(`${base}/settings`);
  }
  if (head === "reviews" || head === "reservations") {
    permanentRedirect(`${base}/performance`);
  }
  // products | scores | scan | anything else → Place
  permanentRedirect(`${base}/place`);
}
