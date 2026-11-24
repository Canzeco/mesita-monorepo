"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";

// A console page whose read failed keeps the frame and the side menu; only
// the body becomes this. The refresh asks the server again.
export default function ConsoleError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <h2 className="text-xl font-semibold tracking-tight">This page didn&apos;t load</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">Mesita didn&apos;t answer. Check your connection and try again.</p>
      <button
        type="button"
        className={`${CTA_BUTTON_CLASS} mt-5`}
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        Try again
      </button>
    </div>
  );
}
