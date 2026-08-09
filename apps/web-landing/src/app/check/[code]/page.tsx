// Permanent redirect for printed/live QRs that still encode
// mesita.ai/check/<code> (MESITA-814). New QRs use check.mesita.ai/<code>.
import { permanentRedirect } from "next/navigation";

export default async function LegacyLandingCheckRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  permanentRedirect(`https://check.mesita.ai/${encodeURIComponent(code)}`);
}
