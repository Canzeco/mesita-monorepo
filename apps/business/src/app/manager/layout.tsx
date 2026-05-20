// Pass-through layout for the entire /manager subtree. The sidebar lives
// in `(shell)/layout.tsx`; routes that need to render full-screen
// (sign-in, sign-up, onboard, create_unit) sit outside that group and
// therefore skip the chrome entirely.
//
// We still pin force-dynamic here so children that read cookies/Supabase
// don't accidentally get statically optimised.

export const dynamic = "force-dynamic";

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
