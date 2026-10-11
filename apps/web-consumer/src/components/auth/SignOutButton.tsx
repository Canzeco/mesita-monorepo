"use client";

import { LogOut } from "lucide-react";
import { authSignOut } from "@/app/auth/actions";

export function SignOutButton({
  redirectTo,
  className,
  label = "Sign out",
}: {
  redirectTo: string;
  className: string;
  label?: string;
}) {
  return (
    <form action={authSignOut.bind(null, redirectTo)} className="contents">
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={className}
      >
        <LogOut className="h-4 w-4" />
        {label}
      </button>
    </form>
  );
}
