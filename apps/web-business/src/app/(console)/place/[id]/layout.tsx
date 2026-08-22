import { cookies } from "next/headers";
import { ACTIVE_PLACE_COOKIE, activePlaceCookieOptions } from "@/lib/active-place";

export const dynamic = "force-dynamic";

export default async function PlaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PLACE_COOKIE, id, activePlaceCookieOptions);
  return children;
}
