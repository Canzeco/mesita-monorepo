import { getMemoConfig } from "./actions";
import { MemoConfigClient } from "./MemoConfigClient";
import { MEMO_DEFAULTS } from "./types";

// Memo Config — its own sidebar section again (MESITA-627). Memo is one of the
// three product agents, not a ranking tab: the Pre-Memo deck is its input, but
// its persona / model / retrieval knobs are its own. /scoring-config/memo now
// redirects here.
//
// The read happens HERE rather than on mount, so a failure is on screen before
// the form is: the client can't tell MEMO_DEFAULTS from the live row, and Save
// writes the whole blob.
export default async function MemoConfigPage() {
  const res = await getMemoConfig();
  return (
    <MemoConfigClient
      initialConfig={res.ok ? res.data : MEMO_DEFAULTS}
      loadError={res.ok ? null : res.error}
    />
  );
}
