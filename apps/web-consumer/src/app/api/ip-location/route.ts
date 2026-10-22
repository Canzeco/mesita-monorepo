import { NextResponse, type NextRequest } from "next/server";

// The guest's approximate location from the network (MESITA-2625): Vercel
// geolocates every request by IP and passes the answer in these headers.
// The location store falls back to it when the device gives no fix (a
// browser that denies geolocation outright, Location Services off, an
// unanswered prompt), so location is automatic. Nothing is stored; the route
// only echoes the request's own headers. Never cached: each guest's own IP.
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store, max-age=0" };

export function GET(req: NextRequest) {
  const latRaw = req.headers.get("x-vercel-ip-latitude");
  const lngRaw = req.headers.get("x-vercel-ip-longitude");
  const lat = latRaw === null ? Number.NaN : Number(latRaw);
  const lng = lngRaw === null ? Number.NaN : Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return NextResponse.json({ coords: null, city: null }, { headers: NO_STORE });
  }
  const cityRaw = req.headers.get("x-vercel-ip-city");
  let city: string | null = null;
  if (cityRaw) {
    try {
      city = decodeURIComponent(cityRaw);
    } catch {
      city = cityRaw;
    }
  }
  return NextResponse.json({ coords: { lat, lng }, city }, { headers: NO_STORE });
}
