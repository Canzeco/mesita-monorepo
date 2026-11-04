import { MemberEntry } from "./MemberEntry";
import { VisitFlow } from "./VisitFlow";

// visit.mesita.ai (MESITA-3221, Pato: "keep it super simple"). A phone camera opens
// this from a guest's QR, whose link names the place and holds the secret
// (MESITA-3240). Without them, staff type the codes instead (MESITA-3262).
export default async function VisitHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { place, code } = await searchParams;
  if (typeof place === "string" && typeof code === "string") {
    return <VisitFlow placeId={place} code={code} />;
  }
  return <MemberEntry />;
}
