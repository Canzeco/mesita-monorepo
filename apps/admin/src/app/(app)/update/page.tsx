import { BusinessLinkForm } from "./BusinessLinkForm";

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
        Paste a Google Place ID. If the venue is in Mesita, you&apos;ll get a
        clean link to its Home in the business console. Open it signed
        into your operator account at business.mesita.ai and you can read
        or edit anything — your email being in super_admins is what
        grants access, not the URL.
      </p>

      <BusinessLinkForm />
    </div>
  );
}
