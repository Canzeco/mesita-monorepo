// Printed QRs that encode mesita.ai/validate/<code> hop to the live staff
// host. The host stays check.mesita.ai until validate.mesita.ai DNS exists.
import { permanentRedirect } from "next/navigation";

export default async function LandingValidateRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  permanentRedirect(`https://check.mesita.ai/${encodeURIComponent(code)}`);
}
