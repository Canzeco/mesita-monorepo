import Link from "next/link";

export default function PlaceNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h1 className="font-display text-2xl font-semibold">This place isn&apos;t yours to open</h1>
      <p className="text-muted-foreground text-sm">Either it doesn&apos;t exist, or you don&apos;t run it on Mesita yet.</p>
      <Link href="/claim" className="text-sm font-semibold underline underline-offset-4">Claim your place</Link>
    </div>
  );
}
