import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// General — the platform settings that are too small to own a sidebar row
// (Pato, 2026-08-21: "create a box for general configuration, to move the
// trivials there too").
//
// The rule: a config page whose ENTIRE content is three controls or fewer
// becomes a card group here. Models (the live picks), Verification (3), and
// Ojo (3 always-visible + a Detection-detail disclosure) all qualified;
// Reservations kept its row (7 knobs and the outbound-call kill switch).
//
// Each group keeps its OWN save, because they write different targets:
// Verification patches app_config columns, Models writes the models_config
// blob, Ojo writes ojo_config. One button firing three EF calls has no
// atomicity, and "Models saved, Verification didn't" is a worse state to
// explain than three owned buttons.
export default function GeneralConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · General"
      title="General"
      description="Platform settings small enough to share a page: which model each subsystem thinks with, who may prove they own a place, and how Ojo reads a guest's screenshot proof."
    >
      {children}
    </ConfigPageLayout>
  );
}
