// The /adea-config routes are now thin redirects into Enricher Config
// (/enricher-config/config) — NOT /atlas-config, which is a separate page since
// Atlas and Enricher were split. No chrome needed: the target page owns the
// header + tabs. Passthrough so nothing flashes before the redirect.
export default function AdeaConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
