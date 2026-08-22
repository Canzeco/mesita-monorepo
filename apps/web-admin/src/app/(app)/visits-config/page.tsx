import { Receipt } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";

// Visits — EMPTY on purpose (Pato, 2026-08-21: "make the fucking page empty…
// just leave a soon… don't hide the current configurations in the html.
// Literally delete it from the html").
//
// The knob census found 16 controls here and ZERO of them enforced: the tip
// chips, poll cadences, send-back ceiling, pay rails and abandonment window
// all saved to app_config.visits_config and nothing read a single one. The
// apps ship their own constants. Rendering sixteen questions no code would
// answer is what made this console exhausting, so the questions are gone.
//
// The BLOB IS UNTOUCHED. visits_config, its normalizer and its two EFs all
// stay: with no client there is nothing to save, so nothing can overwrite the
// stored values, and the day THE TICKET reads them the controls come back.
// What each knob means lives in Notion Docs › Visits.
export const dynamic = "force-dynamic";

export default function VisitsConfigPage() {
  return (
    <ConfigSoon
      Icon={Receipt}
      title="Visits is coming soon"
      body="THE TICKET runs on constants the apps ship today. When the journey reads its policy from here — tip chips, poll cadence, proof, send-backs, pay rails — this page comes back with the knobs that actually do something."
      doc="Notion Docs › Visits"
    />
  );
}
