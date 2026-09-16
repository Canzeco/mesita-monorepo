"use client";

// Menus — what the place serves. A view with an address and no rail row.
import { FileText, Link2 } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { MENUS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { day } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";

export function MenusView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  const menus = listFor(MENUS.filter((m) => m.placeId === place.id), scenario);
  const readOnly = place.myRole === "viewer";

  return (
    <Section
      title="Menus"
      description="A PDF is rendered in the app. A link opens the venue's own page and is never cached."
      right={!readOnly && <button type="button" className={PILL_BUTTON_CLASS}>Add a menu</button>}
    >
      {menus.length === 0 ? (
        <EmptyState
          title="No menus yet"
          hint="Guests looking at this place see the photos and the reviews, and then they leave to find the menu somewhere else."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {menus.map((m) => (
            <li
              key={m.id}
              className="border-border flex items-center gap-3 rounded-xl border px-3 py-2.5"
            >
              {m.kind === "pdf" ? (
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Link2 className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="text-muted-foreground text-[11px]">
                  {m.kind === "pdf" ? `${m.pages} pages` : "External link"} · updated {day(m.updatedAt)}
                </p>
              </div>
              <Badge tone={m.kind === "pdf" ? "good" : "neutral"}>{m.kind.toUpperCase()}</Badge>
              {!readOnly && (
                <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
                  Replace
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
