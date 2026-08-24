import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// The consumer app's ONE shared primary-CTA primitive (MESITA-1223 item 2).
// Shape copied from apps/web-validate's src/components/ui/button.tsx (cva +
// asChild + a variant/size axis) — the colors are this app's own brand
// system, not shadcn's default palette.
//
// SCOPE IS DELIBERATELY NARROW. A 2026-08-23 read of the 34 files this
// migrates found `bg-pink-gradient` (globals.css: `background:
// var(--gradient-pink)`) hand-rolled 47 times as a raw string, but only 18
// of those are actually a clickable button or link with the gradient as its
// WHOLE surface. The other 29 paint icon tiles, avatar story-rings, photo
// placeholders, chat bubbles, badges, a rating-bar fill and a toggle-switch
// track — decorative reuses of the same brand token, never a button. Those
// stay hand-rolled: wrapping a non-interactive `<div>`/`<span>` in `<Button>`
// would hand it click/keyboard/disabled semantics it never asked for, and
// would trip the MESITA-1220 type-role guard for no reason.
//
// Of the 18 real sites, height/radius/padding cluster into three genuine
// shapes plus one icon case — see the size variants below. Text size, font
// weight, `shadow-glow` and width (`w-full`/`flex-1`) are NOT baked in here
// on purpose: `shadow-glow` and the `type-*` roles are custom `@utility`
// classes (globals.css), and tailwind-merge only reconciles Tailwind's own
// recognized class groups — pairing a custom utility against a baked-in
// default risks an "emission order, not what you wrote" race, exactly the
// footgun src/lib/type-roles.ts documents for `type-eyebrow` + `font-*`. A
// call site that wants the glow, a different weight, or a `type-*` role
// passes it via `className`, never fighting a base default for it.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-white transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The only color this migration ships: the brand pink-gradient CTA.
        // Add a variant here (never overload this one) if a future primary
        // action needs a different fill.
        primary: "bg-pink-gradient",
      },
      size: {
        // Standalone hero CTA — 404, empty states: content-width pill.
        default: "h-11 rounded-full px-6",
        // Full-width flow-forward CTA inside a card/step/sheet footer.
        lg: "min-h-12 rounded-2xl",
        // Modal form-submit CTA — a notch smaller, softer corner.
        sm: "min-h-11 rounded-lg py-3",
        // Square icon-only CTA (composer send, etc.).
        icon: "size-8 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
