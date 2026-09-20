// "PUBLISH YOUR MENU FIRST" — the door three products share (MESITA-2017).
//
// Online Orders sells from the published menu, the Answering Agent quotes it,
// and the Express Website prints it. While `menuPublishedAt` is null none of
// the three has an input, and the honest screen says so ONCE, at the top,
// with the way to fix it — rather than three products each inventing a
// sentence about a menu that is not there.
//
// It renders nothing when the menu is published. A door that stays on the
// screen after it has been walked through is a heading about the past.
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { productKeyHref } from "@/lib/product-routes";
import type { MockPlace } from "@/mock/types";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

export function MenuDoor({ place, reads }: { place: MockPlace; reads: string }) {
  if (place.menuPublishedAt !== null) return null;
  return (
    <div
      role="status"
      className="border-border flex flex-wrap items-center gap-3 rounded-2xl border border-dashed p-4"
    >
      <BookOpen className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-display text-sm font-semibold tracking-tight">
          Publish your menu first
        </p>
        <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
          {reads} reads the published menu, and nothing is published yet. It
          keeps working from the moment you press Publish on Digital Menu.
        </p>
      </div>
      <Link
        href={productKeyHref(place.id, "products", "menu")}
        className={GHOST_PILL_BUTTON_CLASS}
      >
        Open Digital Menu
      </Link>
    </div>
  );
}
