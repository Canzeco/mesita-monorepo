import { getSourcingConfig } from "../actions";
import { SourcingPlaygroundClient } from "../SourcingPlaygroundClient";
import { DEFAULT_CONFIG } from "../catalog";

// Sourcing Config · Playground — test a candidate place against every channel.
// Seeds the saved policy so the verdicts reflect the live floors.
export const dynamic = "force-dynamic";

export default async function SourcingPlaygroundPage() {
  const res = await getSourcingConfig();
  return (
    <SourcingPlaygroundClient
      config={res.ok ? res.config : DEFAULT_CONFIG}
      loadError={res.ok ? null : res.error}
    />
  );
}
