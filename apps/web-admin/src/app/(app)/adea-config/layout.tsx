// The /adea-config routes are now thin redirects into the unified
// "Atlas & Enricher Config" page (/atlas-config). No chrome needed — the target
// page owns the header + tabs. Passthrough so nothing flashes before the redirect.
export default function AdeaConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
