import { redirect } from "next/navigation";

// `home` is no longer a destination in the mobile console — the six
// Section nav surfaces start at Place. Anything still pointing here (old
// links, bookmarks, post-create redirects) lands on Place.
export const dynamic = "force-dynamic";

export default async function BusinessHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/unit/${id}/place`);
}
