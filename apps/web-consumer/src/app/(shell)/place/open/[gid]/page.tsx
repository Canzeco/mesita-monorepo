import { OpeningGooglePlace } from "@/components/consumer/OpeningGooglePlace";

// Hard twin of the opening slide-over (MESITA-2311): a reload or a pasted
// link lands here full-page. The client still creates the profile and
// replaces this route with it; nothing is created on the server.
export default async function OpeningGooglePlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ gid: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { gid } = await params;
  const { name } = await searchParams;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <OpeningGooglePlace
        gid={decodeURIComponent(gid)}
        name={typeof name === "string" ? name : ""}
        apiKey={process.env.NEXT_PUBLIC_GMP_KEY ?? ""}
        variant="page"
      />
    </div>
  );
}
