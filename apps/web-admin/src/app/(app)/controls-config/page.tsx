import { getControlsConfig } from "./actions";
import { ControlsConfigClient } from "./ControlsConfigClient";
import { CONTROLS_FALLBACK } from "./defaults";

// Credits — one box of WIRED knobs (the Terms box: the hold, the bonus that
// pays for it, and the expiry) plus a parked Gifting box. One blob, one Save:
// controls_config, whose name the label rename deliberately did not follow.
export const dynamic = "force-dynamic";

export default async function ControlsConfigPage() {
  const controls = await getControlsConfig();
  return (
    <ControlsConfigClient
      initialConfig={controls.ok ? controls.config : CONTROLS_FALLBACK}
      initialUpdatedAt={controls.ok ? controls.updatedAt : null}
      loadError={controls.ok ? null : controls.error}
    />
  );
}
