import { ModelsConfigClient } from "./ModelsConfigClient";

// Models Config — the flat provider + model picker per subsystem. The client
// self-loads the saved blob on mount (admin-web-get-models-config); on load
// failure it keeps DEFAULTS and a Save surfaces the real error, so the page
// stays usable either way.
export const dynamic = "force-dynamic";

export default function ModelsConfigPage() {
  return <ModelsConfigClient />;
}
