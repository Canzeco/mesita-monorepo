// Passthrough — the /new-visit page owns its own server fetch + UI.
export default function NewVisitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
