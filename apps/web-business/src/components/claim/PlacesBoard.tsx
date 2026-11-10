"use client";

// Places' left column (Pato, MESITA-3152: "add other box for selected
// place… you change what is the currently selected place"): Selected, the
// place the side menu works on, over Yours, the places you run. Select on a
// row makes it the menu's place without opening it; Open goes to its profile.
// The pick lives in lib/shell-place.ts, remembered on this browser.

import Link from "next/link";
import { CheckCircle2, Store } from "lucide-react";
import type { MyPlace, MyPlaceState } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { selectShellPlace, useTrustedShellPlace } from "@/lib/shell-place";
import { claimHref, placeTabHref } from "@/lib/routes";

const STATE_COPY: Record<MyPlaceState, string> = {
  owner: "You run this place",
  pending: "Mesita is reviewing your request",
  expired: "Your verification ended. Claim it again.",
  rejected: "Not approved",
};

const PRIMARY = "bg-foreground text-background shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold";
const SECONDARY = "border-border hover:bg-muted/60 shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors";

function Thumb({ photo, size = "size-12" }: { photo: string | null; size?: string }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />
  ) : (
    <span className={`bg-muted text-muted-foreground flex ${size} shrink-0 items-center justify-center rounded-xl`}>
      <Store className="size-5" aria-hidden />
    </span>
  );
}

function BoxTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground text-sm">{sub}</p>
    </div>
  );
}

export function PlacesBoard({ places, isSuperAdmin }: { places: MyPlace[]; isSuperAdmin: boolean }) {
  const run = places.filter((p) => p.state === "owner");
  // The same choice the side menu makes: your pick while you still run it
  // (staff: any place they opened that still opens, MESITA-3590), else the
  // first place you run.
  const picked = useTrustedShellPlace(isSuperAdmin, run.map((p) => p.place_id));
  const mine = run.find((p) => p.place_id === (picked?.id ?? run[0]?.place_id)) ?? null;
  const selected = picked
    ? { id: picked.id, name: mine?.name ?? picked.name, photo: mine?.photo ?? picked.photo, role: mine?.role ?? null }
    : mine
      ? { id: mine.place_id, name: mine.name, photo: mine.photo, role: mine.role }
      : null;
  const roleLine = selected?.role === "owner" ? "Owner" : selected?.role === "editor" ? "Editor" : isSuperAdmin ? "Mesita staff" : null;

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <BoxTitle title="Selected" sub="The place the menu works on: its Profile, Reviews, Premier and Settings." />
        {selected ? (
          <div className="bg-muted/50 flex items-center gap-4 rounded-2xl p-4">
            <Thumb photo={selected.photo} size="size-16" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{selected.name ?? "Unnamed place"}</p>
              {roleLine ? <p className="text-muted-foreground text-sm">{roleLine}</p> : null}
            </div>
            <Link href={placeTabHref(selected.id, "profile")} className={PRIMARY}>
              Open
            </Link>
          </div>
        ) : (
          <div className="bg-muted/50 flex flex-col items-center gap-2 rounded-2xl px-5 py-8 text-center">
            <Store className="text-muted-foreground size-6" aria-hidden />
            <p className="font-semibold">No place selected.</p>
            <p className="text-muted-foreground max-w-xs text-sm">Claim your place under All; it shows up here once it&apos;s yours.</p>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <BoxTitle title="Yours" sub="The places you run. Select one to work on it, or open it." />
        {places.length === 0 ? (
          <div className="bg-muted/50 flex flex-col items-center gap-2 rounded-2xl px-5 py-8 text-center">
            <Store className="text-muted-foreground size-6" aria-hidden />
            <p className="font-semibold">You don&apos;t run a place on Mesita yet.</p>
            <p className="text-muted-foreground max-w-xs text-sm">Find it under All and claim it.</p>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {places.map((p) => {
              const isSelected = selected?.id === p.place_id;
              return (
                <li key={p.place_id} className="flex items-center gap-4 px-1 py-3">
                  <Thumb photo={p.photo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name ?? "Unnamed place"}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {STATE_COPY[p.state]}
                      
                    </p>
                    {p.state === "rejected" && p.decision_note ? (
                      <p className="text-muted-foreground mt-1 text-sm">&ldquo;{p.decision_note}&rdquo;</p>
                    ) : null}
                  </div>
                  {p.state === "owner" ? (
                    <div className="flex shrink-0 items-center gap-2">
                      {isSelected ? (
                        <span className="text-muted-foreground inline-flex items-center gap-1 px-2 text-sm font-medium">
                          <CheckCircle2 className="size-4" aria-hidden /> Selected
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectShellPlace({ id: p.place_id, name: p.name, photo: p.photo })}
                          className={SECONDARY}
                        >
                          Select
                        </button>
                      )}
                      <Link href={placeTabHref(p.place_id, "profile")} className={PRIMARY}>
                        Open
                      </Link>
                    </div>
                  ) : p.state === "expired" || p.state === "rejected" ? (
                    <Link href={claimHref(p.place_id)} className={SECONDARY}>
                      Claim again
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
