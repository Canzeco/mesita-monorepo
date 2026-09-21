"use client";

// "PUBLISH YOUR MENU FIRST" — the door three products share (MESITA-2017).
//
// Online Orders sells from the published menu, the Answering Agent quotes it,
// and the Express Website prints it. While `menuPublishedAt` is null none of
// the three has an input, and the honest screen says so ONCE, at the top,
// with the way to fix it — rather than three products each inventing a
// sentence about a menu that is not there.
//
// RENDERS A `Notice` NOW (MESITA-2034, §7). It used to be its own dashed
// card; `Notice` is the shared shape for every "you need to do this first"
// door on a Setup half, at priority 1 — a Locked/error banner (priority 0)
// outranks it when both would be up at once.
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { productKeyHref } from "@/lib/product-routes";
import type { MockPlace } from "@/mock/types";
import { Notice } from "@/components/shared/Notice";

export function MenuDoor({ place, reads }: { place: MockPlace; reads: string }) {
  const router = useRouter();
  return (
    <Notice
      show={place.menuPublishedAt === null}
      icon={<BookOpen className="h-4 w-4" aria-hidden />}
      title="Publish your menu first"
      note={`${reads} reads the published menu, and nothing is published yet. It keeps working from the moment you press Publish on Digital Menu.`}
      action={{
        label: "Open Digital Menu",
        onClick: () => router.push(productKeyHref(place.id, "products", "menu")),
      }}
    />
  );
}
