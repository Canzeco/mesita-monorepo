// THE PLACE'S PHOTO, at three sizes.
//
// A photo, never an icon: an icon is identical on every venue, and the whole
// job of this chip is to tell one from another at a glance.
//
// It lived in `RailSelector.tsx` until MESITA-1918 deleted that file with the
// selector. The chip outlived it because the CATALOGUE renders one per row,
// which is the surface that does the switching now.
//
// ITS FALLBACK NO LONGER PAINTS WITH RAIL TOKENS (MESITA-1975). A placeless
// chip used to be `bg-sidebar-accent text-sidebar-muted` — white at 10% behind
// white at 64% — which was legible on the ink rail and INVISIBLE everywhere
// else it has ever rendered: the catalogue, and now the Place page and
// `PlaceHeading`. The rail is gone, so the page tokens are the only ones left.
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  /** In a list row or beside a page heading. */
  rail: "h-6 w-6 rounded-md",
  // 30px (MESITA-2034, Apple's account-row anatomy in the sidebar's venue
  // band). Up from 20px — the only caller is Sidebar.tsx's venue chip.
  menu: "h-[30px] w-[30px] rounded-lg",
  /** THE PLACE PAGE, where the venue is the subject rather than a label. */
  page: "h-11 w-11 rounded-xl",
} as const;

const CHIP = "shrink-0 object-cover";

export function PlaceChip({
  photoUrl,
  size = "rail",
}: {
  photoUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  const cls = cn(CHIP, SIZES[size]);
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- a data-URI chip; next/image's layout cost buys nothing here
    return <img src={photoUrl} alt="" className={cls} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        cls,
        "bg-muted text-muted-foreground flex items-center justify-center",
      )}
    >
      <Store className={size === "page" ? "h-5 w-5" : "h-3 w-3"} />
    </span>
  );
}
