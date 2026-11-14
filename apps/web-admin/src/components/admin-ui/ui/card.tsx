import * as React from "react";
import { cn } from "../cn";
import { CARD_CLASS } from "../classes";

// shadcn `card`, cut to the surface: the kit's SectionCard draws the header.
function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="card" className={cn(CARD_CLASS, className)} {...props} />;
}

export { Card };
