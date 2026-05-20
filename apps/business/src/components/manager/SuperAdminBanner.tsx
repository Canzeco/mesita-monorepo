import { Shield } from "lucide-react";

// Rendered by the unit shell layout when manager-get-overview returned
// `isSuperAdmin: true` — i.e. the signed-in operator's email is in
// public.super_admins. Keeps the operator aware they're acting on
// behalf of every venue, not their own.
export function SuperAdminBanner() {
  return (
    <div className="bg-foreground text-background flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold tracking-wider uppercase md:px-8">
      <Shield className="h-3 w-3" />
      Super-admin · acting on behalf of all venues
    </div>
  );
}
