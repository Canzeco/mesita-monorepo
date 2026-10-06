// The console shell. One frame over every screen.
//
// The real console's twin of this file awaits a Supabase session, redirects to
// /signin without one, and calls an Edge Function for the viewer before it
// paints a row. This one renders a frame. That IS the difference between the
// two apps, and it is the whole difference — everything below here is the same
// shape, reading the same fields, in the same order.
//
// There is no provider to mount: the scenario is an external store
// (`mock/store.ts`) that every screen subscribes to directly.
import { AppShell } from "@/components/console/AppShell";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
