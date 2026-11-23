// A guest's face on a Business list (MESITA-4554, Pato: "more friendly
// profile picture"): the photo, or the default avatar, with the Instagram
// glyph for a verified Instagram they show. No VIP crown since MESITA-4709
// (Pato: "no more VIP"); `vip` still rides the payload, unread. Every
// profile is public (MESITA-4690); only a signed-out view comes without a
// photo.
import { DefaultAvatar, SizedImg } from "@mesita/place-profile";
import { cn } from "@/lib/utils";

export type GuestFace = { avatar_url: string | null; vip: boolean; instagram: boolean } | null;

const MARK = "ring-card absolute -bottom-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2";

export function GuestAvatar({ face, size = 40 }: { face: GuestFace; size?: number }) {
  const px = `${size}px`;
  return (
    <span className="relative block shrink-0" style={{ width: px, height: px }}>
      {face?.avatar_url ? (
        <SizedImg src={face.avatar_url} size="thumb" alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="block h-full w-full overflow-hidden rounded-full">
          <DefaultAvatar className="h-full w-full" />
        </span>
      )}
      {face?.instagram ? (
        <span
          aria-hidden
          className={cn(MARK, "-left-0.5 bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-[10px] w-[10px]">
            <rect width="20" height="20" x="2" y="2" rx="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <path d="M17.5 6.5h.01" />
          </svg>
        </span>
      ) : null}
    </span>
  );
}
