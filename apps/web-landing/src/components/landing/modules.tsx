import { SolutionList } from "@/components/landing/solution-list";
import { MODULES } from "@/components/landing/solutions";

// 🦚 Main § 5, Restaurant Modules (MESITA-4994): the products that deliver the
// restaurant solutions. One card of rows in two columns on desktop, never a
// tile grid; one column on a phone.
function Modules() {
  const half = Math.ceil(MODULES.length / 2);
  return (
    <section id="modules" className="border-border scroll-mt-16 border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-20 md:py-24">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            Restaurant Modules
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Eight modules, one console.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            A solution is what the owner receives. A module is the product that
            delivers it.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <SolutionList items={MODULES.slice(0, half)} />
          <SolutionList items={MODULES.slice(half)} start={half + 1} />
        </div>
      </div>
    </section>
  );
}

export { Modules };
