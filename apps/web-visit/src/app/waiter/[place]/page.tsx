import { WaiterSignIn } from "./WaiterSignIn";

// /waiter/<place> — the manager's waiter link (MESITA-4823): the phone types
// the waiter code once per 12 hours, then scans guests.
export default async function Page({ params, searchParams }: { params: Promise<{ place: string }>; searchParams: Promise<{ scan?: string }> }) {
  const [{ place }, { scan }] = await Promise.all([params, searchParams]);
  return <WaiterSignIn placeId={place} scan={typeof scan === "string" ? scan : null} />;
}
