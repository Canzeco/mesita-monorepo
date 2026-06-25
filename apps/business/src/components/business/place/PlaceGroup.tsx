import { cn } from "@/lib/utils";

export function PlaceGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
