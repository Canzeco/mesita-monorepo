// /pay layout is intentionally minimal — every page underneath this
// route is now a redirect stub to /coupons. The header + sub-tabs that
// used to render here are gone; keeping the layout file as a passthrough
// so the (shell) onboarding gate still runs even on the brief redirect.
export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
