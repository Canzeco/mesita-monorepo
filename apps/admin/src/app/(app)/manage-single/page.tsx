import { SingleUnitConsole } from "./SingleUnitConsole";

export const dynamic = "force-dynamic";

export default function ManageSingleUnitPage() {
  return (
    <div className="mx-auto max-w-6xl px-8 pt-12 pb-14">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Units · Single
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Manage Single Unit
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
        Search any venue and run it end-to-end — Place, Promos, Scan,
        Performance, Team. Edits write straight to the venue through the
        business edge functions; your super-admin access bypasses membership.
      </p>

      <SingleUnitConsole />
    </div>
  );
}
