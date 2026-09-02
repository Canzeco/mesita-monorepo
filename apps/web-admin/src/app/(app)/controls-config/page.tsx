import { getControlsConfig } from "./actions";
import { ControlsConfigClient } from "./ControlsConfigClient";
import { CONTROLS_FALLBACK } from "./defaults";

// Controls — one box of WIRED knobs (the Credits hold and the bonus that pays
// for it) plus a parked Gifting box. One blob, one Save: controls_config.
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
