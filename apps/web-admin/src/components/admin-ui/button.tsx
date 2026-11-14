import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";
import { buttonVariants, type ButtonVariantProps } from "./ui/button";

export type ButtonTone = NonNullable<ButtonVariantProps["tone"]>;
export type ButtonSize = NonNullable<ButtonVariantProps["size"]>;

/** The button classes, for the rare host that must stay a non-button element. */
export function buttonClass({
  tone = "primary",
  size = "md",
  className,
}: { tone?: ButtonTone; size?: ButtonSize; className?: string } = {}) {
  return cn(buttonVariants({ tone, size }), className);
}

type Common = {
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Spinner replaces the leading icon; the button is disabled. */
  pending?: boolean;
  /** Leading glyph on labelled buttons. On `size="icon"` pass the glyph as children. */
  icon?: React.ReactNode;
  /** Layout only (margin, width). */
  className?: string;
  children?: React.ReactNode;
};

type AsButton = Common &
  Omit<React.ComponentProps<"button">, "className" | "children"> & { href?: undefined };
type AsLink = Common & {
  /** Renders a Next Link with the same classes; absolute http(s) opens a new tab. */
  href: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

/**
 * The one button (MESITA-3948). Tones: primary (ink), secondary, ghost,
 * danger, danger-ghost. `type` defaults to "button": a submit button says
 * `type="submit"`.
 */
export function Button(props: AsButton | AsLink) {
  const { tone = "primary", size = "md", pending = false, icon, className, children } = props;
  const classes = cn(buttonVariants({ tone, size }), className);
  const lead = pending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : size === "icon" ? null : icon;
  const body = (
    <>
      {lead}
      {size === "icon" && pending ? null : children}
    </>
  );

  if (typeof props.href === "string") {
    const { href, disabled, title, onClick } = props;
    if (disabled || pending) {
      return (
        <span aria-disabled="true" title={title} aria-label={props["aria-label"]} className={classes}>
          {body}
        </span>
      );
    }
    const external = /^https?:\/\//i.test(href);
    return (
      <Link
        href={href}
        title={title}
        aria-label={props["aria-label"]}
        onClick={onClick}
        className={classes}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {body}
      </Link>
    );
  }

  const {
    tone: _t,
    size: _s,
    pending: _p,
    icon: _i,
    className: _c,
    children: _ch,
    href: _h,
    type = "button",
    disabled,
    ...rest
  } = props as AsButton;
  return (
    <button {...rest} type={type} disabled={disabled || pending} className={classes}>
      {body}
    </button>
  );
}
