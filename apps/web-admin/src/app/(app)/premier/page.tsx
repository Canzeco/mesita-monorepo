import { listPremier } from "./actions";
import { PremierClient } from "./PremierClient";

export const dynamic = "force-dynamic";

export default async function PremierPage() {
  const res = await listPremier();
  return <PremierClient initial={res.ok ? res.list : null} loadError={res.ok ? null : res.error} />;
}
