import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import type { DiscoveryConfig } from "../catalog";
import {
  ChatBox,
  MapBox,
  PlacesBox,
  SocialBox,
  WordAdminBox,
  WordBox,
} from "../ModeBoxes";

// Discovery › Modes: six boxes, one per mode (MESITA-2303).
export function DiscoveryModesView({ seed }: { seed: ConfigSeed<DiscoveryConfig> }) {
  return (
    <div className="flex flex-col gap-6">
      <WordAdminBox />
      <WordBox {...seed} />
      <MapBox {...seed} />
      <PlacesBox {...seed} />
      <SocialBox />
      <ChatBox {...seed} />
    </div>
  );
}

export default function DiscoveryModesPage() {
  return null;
}
