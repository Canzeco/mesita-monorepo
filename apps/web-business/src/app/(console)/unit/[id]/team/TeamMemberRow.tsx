import type { ReactNode } from "react";

export function TeamMemberRow({ children }: { children: ReactNode }) {
  return <li className="flex items-center gap-2.5 px-3 py-2.5">{children}</li>;
}
