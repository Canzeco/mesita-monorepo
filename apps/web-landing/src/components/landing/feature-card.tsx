import { type LucideIcon } from "lucide-react";

function FeatureCard({
  title,
  body,
  Icon,
  iconClass,
}: {
  title: string;
  body: string;
  Icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <article className="border-border bg-background flex flex-col gap-3 rounded-2xl border p-6">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
    </article>
  );
}

export { FeatureCard };
