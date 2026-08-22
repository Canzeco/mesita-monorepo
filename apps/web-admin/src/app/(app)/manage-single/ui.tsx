"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePlaceContext } from "./PlaceContext";

// Thin re-export shim — implementation lives in `@/components/admin-ui/manage`.
// Prefer importing from `@/components/admin-ui` (or `/manage`) in new code.
// CrossTabLink stays here: it needs PlaceContext (route-local).

export {
  SectionCard,
  GroupLabel,
  TextField,
  PhoneField,
  TextArea,
  SelectField,
  SaveBar,
  ConfirmDialog,
  Spinner,
  ReadField,
  OpenLink,
  CopyIdButton,
  type Tint,
} from "@/components/admin-ui/manage";

/** Link out to another place tab, routed through the discard guard. */
export function CrossTabLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { guardNav } = usePlaceContext();
  return (
    <Link
      href={href}
      onClick={(e) => guardNav(href, e)}
      className={
        className ??
        "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition"
      }
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
