// THE PLACE'S PHOTO, at two sizes.
//
// A photo, never an icon: an icon is identical on every venue, and the whole
// job of this chip is to tell one from another at a glance.
//
// It lived in `RailSelector.tsx` until MESITA-1918 deleted that file with the
// selector. The chip outlived it because the CATALOGUE renders one per row,
// which is the surface that does the switching now.
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

const CHIP = "h-6 w-6 shrink-0 rounded-md object-cover";

export function PlaceChip({
  photoUrl,
  size = "rail",
}: {
  photoUrl: string | null;
  size?: "rail" | "menu";
}) {
  const cls = size === "menu" ? "h-5 w-5 shrink-0 rounded-md object-cover" : CHIP;
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- a data-URI chip; next/image's layout cost buys nothing here
    return <img src={photoUrl} alt="" className={cls} />;
  }
  return (
    <span
      aria-hidden
      className={cn(cls, "bg-sidebar-accent text-sidebar-muted flex items-center justify-center")}
    >
      <Store className="h-3 w-3" />
    </span>
  );
}
