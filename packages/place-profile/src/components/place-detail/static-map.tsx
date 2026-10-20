"use client";

import { MapPin } from "lucide-react";

// A keyless street map for the Location section (MESITA-2441):
// OpenStreetMap's standard tiles around the place, the pin at the center.
// No SDK, no API key, so it draws in a static render and on the admin phone
// alike. decision: OSM tiles — Google Static Maps refused the app's key
// (no NEXT_PUBLIC key in the consumer) and CARTO's basemaps now answer
// "API key required". OSM asks for attribution and light use; a busy
// catalog moves this to a keyed provider.

const ZOOM = 16;
const TILE = 256;
// 5 × 3 tiles keep the pin centered on a map up to 1024px wide and 512 tall.
const COLS = 5;
const ROWS = 3;

/** Web-Mercator tile coordinates (fractional) of a point at ZOOM. */
export function tileCoords(lat: number, lng: number): { x: number; y: number } {
  const n = 2 ** ZOOM;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

export function StaticMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const { x, y } = tileCoords(lat, lng);
  const x0 = Math.floor(x) - Math.floor(COLS / 2);
  const y0 = Math.floor(y) - Math.floor(ROWS / 2);
  const pinX = (x - x0) * TILE;
  const pinY = (y - y0) * TILE;
  const tiles: Array<{ tx: number; ty: number }> = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) tiles.push({ tx: x0 + c, ty: y0 + r });
  }
  return (
    <div className="bg-muted relative h-44 w-full overflow-hidden rounded-xl">
      <div
        className="absolute grid"
        style={{
          width: COLS * TILE,
          height: ROWS * TILE,
          left: `calc(50% - ${pinX.toFixed(1)}px)`,
          top: `calc(50% - ${pinY.toFixed(1)}px)`,
          gridTemplateColumns: `repeat(${COLS}, ${TILE}px)`,
        }}
        aria-hidden
      >
        {tiles.map(({ tx, ty }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${tx}-${ty}`}
            src={`https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`}
            alt=""
            width={TILE}
            height={TILE}
            loading="lazy"
            draggable={false}
            className="block h-64 w-64 max-w-none select-none"
          />
        ))}
      </div>
      <span
        role="img"
        aria-label={`Map of ${label}`}
        className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-full items-center justify-center"
      >
        <MapPin
          className="text-foreground fill-foreground h-9 w-9 drop-shadow"
          strokeWidth={1.5}
          stroke="white"
        />
      </span>
      <span className="text-muted-foreground absolute right-1 bottom-1 rounded bg-white/80 px-1 text-[10px] leading-tight">
        © OpenStreetMap contributors
      </span>
    </div>
  );
}
