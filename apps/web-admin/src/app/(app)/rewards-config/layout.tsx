// /rewards-config permanently redirects to Visits. No chrome here — the
// form is composed onto /visits-config (MESITA-1784), same shape as Ojo.
export default function PromosConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
