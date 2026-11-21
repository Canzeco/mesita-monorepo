import { redirect } from "next/navigation";

// Stories is a card on General (MESITA-4534; config only since MESITA-4553).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/places/${encodeURIComponent(id)}/general#stories`);
}
