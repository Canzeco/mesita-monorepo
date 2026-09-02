import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Credits — the Wallet's Credits policy. One flat page. A label never repeats
// its section heading, which is why the terms box below is called Terms: the
// page took the name Credits in the rename and a box cannot hold it too.
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
    <ConfigPageLayout eyebrow="Product · Credits" title="Credits">
      {children}
    </ConfigPageLayout>
  );
}
