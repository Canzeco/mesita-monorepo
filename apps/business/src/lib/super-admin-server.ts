// Server-only super-admin helper. Lives in its own file because the
// `next/headers` import is server-component-only — if a client component
// or middleware ever imports it, the bundler errors. The query-param name
// + link helpers stay in `super-admin.ts` (universal).

import { headers } from "next/headers";
import { SUPER_ADMIN_HEADER } from "./super-admin";

// Reads the superkey from the request header that middleware populates
// from the `?superkey=` query param. Returns null when not in super-admin
// mode. Works in layouts AND pages — layouts don't receive searchParams,
// so this header indirection is what lets the unit shell load an overview
// for super-admin operators.
export async function getSuperAdminKey(): Promise<string | null> {
  const hdrs = await headers();
  const value = hdrs.get(SUPER_ADMIN_HEADER);
  return value && value.length > 0 ? value : null;
}
