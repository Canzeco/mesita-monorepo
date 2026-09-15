import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Payments — the Wallet's Credits policy. One flat page. A label never repeats
// its section heading, which is why the wired box below is called Credits: the
// page gave that word up in the MESITA-1854 rename, so the box could take it.
//
// The directory, the route and the blob all stay `controls-config` /
// `controls_config`. A rename stops at the label here as it does everywhere on
// this rail — see `nav.ts`.
export default function ControlsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout eyebrow="Product · Payments" title="Payments">
      {children}
    </ConfigPageLayout>
  );
}
