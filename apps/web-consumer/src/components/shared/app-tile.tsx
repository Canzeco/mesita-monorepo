// ONE TILE FOR EVERY APP ICON (MESITA-3990, Pato: "those logos look like
// shit"). The official files of MESITA-3985/3987 came in five shapes — a
// hard square, outlined tiles, a bare envelope, a solid tile — so side by
// side they never read as a set. Every app icon now sits on the same tile,
// as a dock draws them: rounded 22.5%, white, a hairline and a soft shadow.
//
// `inset` marks whose file has no background of its own (Google Calendar,
// Outlook) sit at 70%; marks whose file is already a tile (Apple Calendar,
// ChatGPT, Claude) fill it.

/* eslint-disable @next/next/no-img-element -- static SVG files, no optimizer needed */

export function AppTile({ src, size, inset }: { src: string; size: number; inset: boolean }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[22.5%] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="object-contain"
        style={{ width: inset ? "70%" : "100%", height: inset ? "70%" : "100%" }}
      />
    </span>
  );
}
