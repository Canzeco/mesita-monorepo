import { AtlasPlaygroundClient } from "../AtlasPlaygroundClient";

// Atlas Config · Playground — preview which place fields each writer may set.
// Reads the shipped static edit matrix (no server data needed).
export const dynamic = "force-dynamic";

export default function AtlasPlaygroundPage() {
  return <AtlasPlaygroundClient />;
}
