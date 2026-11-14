import { cva, type VariantProps } from "class-variance-authority";
import { FOCUS_RING_CLASS, TOUCH_TARGET_CLASS } from "../classes";

// shadcn `button`, edited to the admin skin (MESITA-3948): primary is ink,
// never `bg-primary`; pills; 44px hit area; the kit focus ring.
export const buttonVariants = cva(
  `inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:shrink-0 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`,
  {
    variants: {
      tone: {
        primary: "bg-foreground text-background hover:opacity-90",
        secondary: "border-border text-muted-foreground hover:bg-muted hover:text-foreground border",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        danger: "bg-destructive text-destructive-foreground hover:opacity-90",
        "danger-ghost": "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
      },
      size: {
        md: "h-10 px-5 text-sm",
        sm: "h-8 px-3 text-xs",
        field: "h-11 px-5 text-sm sm:h-10",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: { tone: "primary", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
