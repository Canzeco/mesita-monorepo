import { Shield } from "lucide-react";

// Rendered globally by the root layout whenever admin-whoami reports
// `isSuperAdmin: true` — i.e. the signed-in operator's email is in
// public.super_admins. Visible across every page (auth surface aside,
// since no session yet) so the operator always knows they're acting on
// behalf of every venue, not their own.
export function SuperAdminBanner() {
  return (
    <div className="bg-foreground text-background flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold tracking-wider uppercase md:px-8">
      <Shield className="h-3 w-3" />
      Super-admin · acting on behalf of all venues
    </div>
  );
}
