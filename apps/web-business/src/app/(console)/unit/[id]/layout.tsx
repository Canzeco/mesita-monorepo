import { cookies } from "next/headers";
import {
  ACTIVE_UNIT_COOKIE,
  activeUnitCookieOptions,
} from "@/lib/active-unit";

export const dynamic = "force-dynamic";

export default async function UnitLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_UNIT_COOKIE, id, activeUnitCookieOptions);
  return children;
}
