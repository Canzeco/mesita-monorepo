import { redirect } from "next/navigation";

// Stories is a section of General (MESITA-4534). This old address lands
// there keeping a story or guest filter (MESITA-4538).
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const story = one(sp.story) ?? one(sp.id);
  const guest = one(sp.story_customer) ?? one(sp.customer);
  if (story) q.set("story", story);
  if (guest) q.set("story_customer", guest);
  const query = q.toString();
  redirect(`/places/${encodeURIComponent(id)}/general${query ? `?${query}` : ""}#stories`);
}
