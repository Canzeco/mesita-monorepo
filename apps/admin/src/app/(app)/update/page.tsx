import { SuperAdminLinkForm } from "./SuperAdminLinkForm";

export default function UpdateUnitPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 pt-12 pb-14">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Units · Single
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Manually update unit
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        Paste a Google Place ID. If the venue is already in Mesita, you'll
        get a one-shot super-admin link that opens its Place editor in the
        manager console with no team membership required.
      </p>

      <SuperAdminLinkForm />
    </div>
  );
}
