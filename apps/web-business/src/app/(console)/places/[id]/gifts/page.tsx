import { redirect } from "next/navigation";

// Gifts are Credits rows since MESITA-4538 (Pato: credits "should also include
// gifts"); this old address lands there.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/places/${encodeURIComponent(id)}/credits`);
}
