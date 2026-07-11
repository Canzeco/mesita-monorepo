"use client";

import { LogOut } from "lucide-react";
import { authSignOut } from "@/app/auth/actions";

export function SignOutButton({
  redirectTo,
  className,
  label = "Sign out",
}: {
  redirectTo: string;
  className?: string;
  label?: string;
}) {
  return (
    <form action={authSignOut.bind(null, redirectTo)} className="contents">
      <button
        type="submit"
        aria-label={label || "Sign out"}
        title={label || "Sign out"}
        className={
          className ??
          "border-border bg-card hover:bg-muted flex w-full items-center justify-center gap-2 rounded-full border py-4 text-sm font-semibold transition"
        }
      >
        <LogOut className="h-4 w-4" />
        {label}
      </button>
    </form>
  );
}
