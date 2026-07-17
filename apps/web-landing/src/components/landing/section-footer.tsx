import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function SectionFooter({
  note,
  cta,
  variant,
}: {
  note: string;
  cta: { href: string; label: string };
  variant: "primary" | "dark";
}) {
  const btnClass =
    variant === "primary"
      ? "bg-pink-gradient shadow-glow rounded-full text-white hover:opacity-90"
      : "bg-foreground text-background hover:bg-foreground rounded-full hover:opacity-90";
  return (
    <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground inline-flex items-center gap-2 text-[13px]">
        <CheckCircle2 className="text-secondary h-4 w-4" />
        {note}
      </p>
      <Button asChild size="lg" className={btnClass}>
        <Link href={cta.href}>
          {cta.label}
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

export { SectionFooter };
