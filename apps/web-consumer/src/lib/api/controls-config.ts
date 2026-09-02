// The Wallet's Credits policy, read from the console-owned blob.
//
// Exists so the Wallet stops hard-coding a hold the admin console claims to
// own. `app_config.controls_config` is edited at Configurations > Credits — the
// page was renamed 2026-09-02 and the blob, route and EF names deliberately did
// not follow — and reaches this surface through consumer-web-get-controls-config
// — an admin
// knob nothing reads is the "unenforced config = bug" failure root CLAUDE.md
// names, and this file is the reader.
//
// The Credits BALANCES are still emulated (no table, no engine). The POLICY is
// real, which is the honest split: the shape of the instrument is a guess, the
// terms the operator set are not.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { ControlsPolicy } from "@/lib/mock/credits-mock";

export async function apiGetControlsPolicy(
  client: SupabaseClient,
): Promise<ControlsPolicy> {
  const { policy } = await invokeEF<{ policy: ControlsPolicy }>(
    client,
    "consumer-web-get-controls-config",
    {},
  );
  return policy;
}
