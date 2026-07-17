import Link from "next/link";
import { ArrowRight, UserCircle } from "lucide-react";

function PathButton({
  href,
  Icon,
  eyebrow,
  label,
  variant,
}: {
  href: string;
  Icon: typeof UserCircle;
  eyebrow: string;
  label: string;
  variant: "primary" | "dark";
}) {
  const className =
    variant === "primary"
      ? "bg-pink-gradient shadow-glow text-white"
      : "bg-foreground text-background";
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-3 rounded-full px-5 py-4 text-left transition hover:opacity-90 ${className}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] tracking-[0.18em] uppercase opacity-80">
          {eyebrow}
        </span>
        <span className="text-[15px] font-semibold">{label}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export { PathButton };
