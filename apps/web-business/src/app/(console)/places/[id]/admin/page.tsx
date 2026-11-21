import { redirect } from "next/navigation";

// One page of sections since MESITA-4534 (Pato: "don't create subpages in
// general"): this old address lands on General, scrolled to its section.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/places/${encodeURIComponent(id)}/general#admin`);
}
