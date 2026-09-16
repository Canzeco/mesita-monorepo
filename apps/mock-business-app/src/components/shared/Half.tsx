// A PRODUCT PAGE READS IN TWO HALVES (MESITA-1924): what you SET, then what
// HAPPENED. Pato: *"all products pages must be divided into two — Manage and
// Activity"*.
//
// THREE OF THE EIGHT ALREADY DID THIS and nobody had named it — Orders was
// `Channels` over `Recent orders`, Visits `Visit checkout` over `Recent
// visits`, Reservations `Your provider` over `Bookings`. The pattern was in
// the pages before the words were, which is why this component is a LABEL and
// not a layout: the cards do not move, they are grouped and named.
//
// NOT TABS. There is no segmented control anywhere in this console, and one
// would cost a shared component, a URL param so a half is linkable, and a
// default-half decision for every product. Stacked halves reuse the eyebrow
// this console already prints in six places (`TINY_LABEL_CLASS`), keep both
// halves visible to a single scan, and put Activity one scroll away instead of
// one click.
//
// "ACTIVITY" MEANS THE SAME THING AT TWO SCALES. It is also a rail row, which
// opens the whole PLACE's activity; a half here is one product's. Decided
// deliberately (MESITA-1924) rather than renamed: one word the console teaches
// once, read at whatever scope you are standing in.
//
// A HALF WITH NOTHING IN IT DOES NOT RENDER. Profile has no activity — a
// description is not an event — and a heading over an empty box is worse than
// no heading. A product earns its second half when it has something to put in
// it.
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";

export function Half({
  label,
  children,
}: {
  label: "Manage" | "Activity";
  children: React.ReactNode;
}) {
  return (
    // A real landmark, not a styled div: two halves on one page are two
    // regions, and a screen reader should be able to jump between them.
    <section aria-label={label} className="flex flex-col gap-4">
      <p className={TINY_LABEL_CLASS}>{label}</p>
      {children}
    </section>
  );
}
