import { OpeningGooglePlace } from "@/components/consumer/OpeningGooglePlace";

// A Google-only place the guest just tapped (MESITA-2311): the slide-over
// opens at once on the generating view (MESITA-2935); the client creates the
// profile and replaces this route with it. Nothing is created on the server.
export default async function OpeningGooglePlaceModal({
  params,
  searchParams,
}: {
  params: Promise<{ gid: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { gid } = await params;
  const { name } = await searchParams;
  return (
    <OpeningGooglePlace
      gid={decodeURIComponent(gid)}
      name={typeof name === "string" ? name : ""}
      variant="modal"
    />
  );
}
