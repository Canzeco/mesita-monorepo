"use client";

// Stories on General (MESITA-4553, Pato: "stories should not have logs … just
// the configuration to define if enabled and if so, to which instagram to tag
// … literally identical to reservations"). Two rows, Reservations' anatomy:
// the Story Voucher switch (the same place_payment_settings.voucher_story as
// Offers; owner only, the server refuses an editor), and the Instagram guests
// tag in their story, the profile's instagram_url, which the guest's Story
// screen reads as @handle.

import { useState } from "react";
import { AtIcon, InstagramLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { updatePlace } from "@/components/place-manage/actions";
import { Card } from "@/components/shell/Page";
import { Switch } from "@/components/ui/config";
import { INPUT_BASE } from "@/components/ui/manage";
import { setPlacePayment } from "@/lib/business-api";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const QUIET =
  "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40";

const MARK_ROW = "grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3 text-sm sm:px-6";

/** "@taqueriaorinoco" from a stored instagram_url, or null. */
export function handleOf(url: string | null | undefined): string | null {
  const s = (url ?? "").trim();
  if (!s) return null;
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const h = (m ? m[1] : s.replace(/^@/, "")).trim();
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : null;
}

/** What the owner typed (a handle, @handle or a link) as the profile link. */
function urlOf(text: string): string | null {
  const h = handleOf(text);
  return h ? `https://www.instagram.com/${h}/` : null;
}

export function StoriesPanel({ placeId, initialOn }: { placeId: string; initialOn: boolean | null }) {
  const { place, setPlace } = usePlaceContext();
  const [on, setOn] = useState(initialOn === true);
  const [pending, setPending] = useState<"switch" | "handle" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const handle = handleOf(place.instagram_url);
  const typed = urlOf(draft);

  async function flip() {
    setPending("switch");
    setError(null);
    const r = await setPlacePayment(placeId, "voucher_story", !on);
    setPending(null);
    if (!r.ok) return setError(r.error);
    setOn(r.data.voucher_story === true);
  }

  async function saveHandle(url: string | null) {
    setPending("handle");
    setError(null);
    const r = await updatePlace({ id: place.id, instagram_url: url });
    setPending(null);
    if (!r.ok) return setError(r.error);
    setPlace(r.data.place);
    setDraft("");
  }

  return (
    <>
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">
          <li className={MARK_ROW} data-place-state="stories">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-pink-100 text-pink-700" : "bg-muted text-muted-foreground")}>
              <InstagramLogoIcon size={22} weight={on ? "fill" : "regular"} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Stories</p>
              <p className="text-muted-foreground">Guests post an Instagram story at your place and get bonus credit here.</p>
            </div>
            <p className={cn("font-semibold whitespace-nowrap", !on && "text-muted-foreground")}>{initialOn === null ? "—" : on ? "On" : "Off"}</p>
            <Switch on={on} pending={pending !== null || initialOn === null} onClick={() => void flip()} label={`Stories: ${on ? "on" : "off"}`} />
          </li>
          <li className="flex min-h-16 flex-wrap items-center gap-4 px-5 py-3 text-sm sm:px-6" data-place-state="story_instagram">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", handle ? "bg-pink-100 text-pink-700" : "bg-muted text-muted-foreground")}>
              <AtIcon size={22} weight={handle ? "bold" : "regular"} aria-hidden />
            </span>
            {/* The minimum is what lets the box wrap under the text on a phone. */}
            <div className="min-w-48 flex-1">
              <p className="font-medium">Instagram to tag</p>
              <p className="text-muted-foreground">Guests tag @mesita and this account in their story.</p>
            </div>
            <p className={cn("font-semibold whitespace-nowrap", !handle && "text-muted-foreground")}>{handle ? `@${handle}` : "None"}</p>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && typed && pending === null) void saveHandle(typed);
                }}
                autoComplete="off"
                autoCapitalize="none"
                placeholder="@yourplace"
                aria-label="Instagram to tag"
                className={cn(INPUT_BASE, "h-10 w-44 px-3")}
              />
              <button type="button" className={QUIET} disabled={!typed || pending !== null} onClick={() => void saveHandle(typed)}>
                {pending === "handle" ? "Saving…" : "Save"}
              </button>
            </div>
          </li>
        </ul>
      </Card>
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
    </>
  );
}
