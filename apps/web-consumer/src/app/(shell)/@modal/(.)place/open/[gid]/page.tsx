import { OpeningGooglePlace } from "@/components/consumer/OpeningGooglePlace";

// A Google-only place the guest just tapped (MESITA-2311): the slide-over
// opens at once on its name and a spinner; the client creates the profile
// and replaces this route with it. Nothing is created on the server.
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
      apiKey={process.env.NEXT_PUBLIC_GMP_KEY ?? ""}
      variant="modal"
    />
  );
}
