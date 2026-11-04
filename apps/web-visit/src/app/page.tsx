import { VisitFlow } from "./VisitFlow";

// visit.mesita.ai (MESITA-3221, Pato: "keep it super simple"). A phone camera opens
// this from a guest's QR, whose link names the place and holds the secret
// (MESITA-3240). Without them there is nothing to do here.
export default async function VisitHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { place, code } = await searchParams;
  if (typeof place === "string" && typeof code === "string") {
    return <VisitFlow placeId={place} code={code} />;
  }
  return (
    <main>
      <h1>Mesita Visit</h1>
      <p>Scan a guest&apos;s QR with your camera to open their visit.</p>
    </main>
  );
}
