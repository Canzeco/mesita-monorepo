import * as React from "react";
import { cn } from "../cn";
import { BONE_CLASS } from "../classes";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn(BONE_CLASS, className)} {...props} />;
}

export { Skeleton };
