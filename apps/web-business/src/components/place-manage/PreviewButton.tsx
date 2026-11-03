"use client";

// Profile's Preview (Pato, MESITA-3136: "put preview as a button with a modal
// in profile"; the first box on Profile since MESITA-3144): the place as guests see it, in a native <dialog> over the
// editor. showModal() makes the page behind inert and Escape closes it.

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Eye, X } from "lucide-react";
import { placeTabFromPathname } from "@/lib/routes";
import { PlacePreview } from "./PlacePreview";
import { Card } from "@/components/shell/Page";

export function PreviewButton() {
  const dialog = useRef<HTMLDialogElement | null>(null);
  // The guest view renders only while the modal is open.
  const [open, setOpen] = useState(false);
  if (placeTabFromPathname(usePathname()) !== "profile") return null;

  return (
    <>
      {/* The first box on Profile, not a corner button (Pato, MESITA-3144:
          "must not be hidden at top right, but maybe the first box with the
          button"). */}
      <Card className="flex flex-wrap items-center gap-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
          <Eye className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">See your profile as guests do</p>
          <p className="text-muted-foreground text-sm">The saved profile, exactly as it shows in the Mesita app.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            dialog.current?.showModal();
          }}
          className="bg-foreground text-background inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Eye className="size-4" aria-hidden /> Preview
        </button>
      </Card>
      <dialog
        ref={dialog}
        aria-label="Preview"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // p-0 + inner wrapper: a click on the <dialog> itself is the backdrop.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        className="bg-background m-auto h-[min(56rem,calc(100dvh-2rem))] w-[min(30rem,calc(100vw-2rem))] rounded-3xl border-0 p-0 shadow-elev backdrop:bg-black/40"
      >
        <div className="flex h-full flex-col gap-3 p-4">
          <div className="flex shrink-0 items-center justify-between">
            <p className="font-semibold">As guests see it</p>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close preview"
              className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-full"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {open ? <PlacePreview /> : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
