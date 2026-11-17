// /sign's fallback (MESITA-4246): a blank card while the server decides
// between the phone step, onboarding and the way back. The bar stays.
export default function SignLoading() {
  return <div aria-hidden className="bg-card flex flex-1" />;
}
