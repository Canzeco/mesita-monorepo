import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import { Skeleton, SkeletonLine } from "@/components/shared/Skeleton";
import { APP_SHARE_TEXT, SHARE_BODY } from "@/lib/share-app";

// /share's fallback. The page reads nothing, but a tap on the bar still
// waits a server round trip for it, and until now that wait was the (shell)
// spinner centred on grey (Pato, MESITA-2701: "the placeholders must be
// similar to the page you are loading, like the sizes").
//
// SharePage block for block, on its own scroller: the title, the line under
// it and the preview line under the buttons are fixed words, drawn as
// themselves; the 1200×630 card is a block at its ratio until the image
// paints; the four ways to send are doors, so each is its 56px disc and a
// 12px label bar.
export default function ShareLoading() {
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Share Mesita
      </h1>
      <p className="text-muted-foreground type-body mt-1">{APP_SHARE_TEXT}</p>

      <div className="mt-5">
        <Skeleton className="aspect-[1200/630] w-full rounded-2xl" />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <SectionEyebrow>Send it</SectionEyebrow>
        <div className="grid grid-cols-4 gap-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-14 w-14 rounded-full" />
              <SkeletonLine
                className="w-full text-xs"
                bar="inset-x-0 mx-auto w-12"
              />
            </div>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground type-body mt-5 text-center">
        Sends: “{SHARE_BODY}”
      </p>
      <p role="status" className="sr-only">
        Loading Share
      </p>
    </div>
  );
}
