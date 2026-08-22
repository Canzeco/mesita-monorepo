import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// General — the platform settings that are too small to own a sidebar row
// (Pato, 2026-08-21: "create a box for general configuration, to move the
// trivials there too").
//
// The rule: a config page whose ENTIRE content is three controls or fewer
// becomes a card group here. Verification (3) and Models (3) qualified;
// Reservations kept its row (7 knobs and the outbound-call kill switch), and
// so did Ojo — a product engine with staged depth behind its three.
//
// Each group keeps its OWN save, because they write different targets:
// Verification patches app_config columns, Models writes the models_config
// blob. One button firing two EF calls has no atomicity, and "Models saved,
// Verification didn't" is a worse state to explain than two owned buttons.
export default function GeneralConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · General"
      title="General"
      description="Platform settings small enough to share a page. Who may prove they own a place, and which model each subsystem thinks with."
    >
      {children}
    </ConfigPageLayout>
  );
}
