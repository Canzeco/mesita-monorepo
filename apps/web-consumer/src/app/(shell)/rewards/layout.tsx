// Passthrough — the /rewards page owns its own server fetch + UI.
export default function RewardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
