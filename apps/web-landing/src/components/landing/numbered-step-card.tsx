import { type LucideIcon } from "lucide-react";

export type NumberedStep = {
  n: string;
  title: string;
  body: string;
  Icon: LucideIcon;
};

/** Numbered "how it works" step card — pink-gradient icon chip, muted step
 * number, title, body. Shared by the how-it-works and rewards sections. */
function NumberedStepCard({ n, title, body, Icon }: NumberedStep) {
  return (
    <article className="border-border bg-background relative flex flex-col gap-3 rounded-2xl border p-6">
      <div className="flex items-center justify-between">
        <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-display text-muted-foreground/40 text-4xl font-semibold">
          {n}
        </span>
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
    </article>
  );
}

export { NumberedStepCard };
