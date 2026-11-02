// Supabase Edge Function — admin-web-enrich-place (product caller / admin)
//
// Direct execute. One place starts enrich single place. A list starts
// enrich multiple places once. Render decides how many places run at once.
// Nothing here waits on the run. Before it calls Render, this marks each
// place enriching (content_state = generating). If Render refuses the run,
// a place still generating goes back to ready when it was enriched before
// and to failed when it never was. The profile is written once, at the end.
// The start itself is _shared/enrich-start.ts, which the guest vote door
// shares. A place already enriching is skipped; when every place is, the
// answer is 409 "Already enriching." (MESITA-2805), so a double press never
// pays for two runs.
//
// Internal enricher control — super-admin gated, admin console only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleEnrichPlace } from "../_shared/enrich-place-handler.ts";

serveJson("admin-web-enrich-place", (req) => handleEnrichPlace(req, "admin-web-enrich-place"));
