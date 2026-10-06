"use client";

// The table QR. Guests get the published menu and nothing else — no console,
// no account. A draft that has not been published says so.
import { use, useEffect } from "react";
import Link from "next/link";
import { publishedSectionsOf } from "@/mock/desk";
import { useMock } from "@/mock/MockStore";
import { money } from "@/lib/format";

export default function GuestMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { world, desk } = useMock();
  const place = world.places.find((p) => p.id === `plc_${slug}` || p.id === slug);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("print") === "1") {
      window.print();
    }
  }, []);

  if (!place) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <p className="text-sm">This menu is not on file.</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">Back to the console</Link>
      </main>
    );
  }

  const sections = publishedSectionsOf(place.id, place.menuPublishedAt, desk);
  const published = place.menuPublishedAt !== null;

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">{place.city}</p>
      <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">{place.name}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {published ? "The menu on the table." : "Not published yet. Guests still see this page, and it says so."}
      </p>
      {published ? (
        <div className="mt-8 flex flex-col gap-6">
          {sections.map((s) => (
            <section key={s.id}>
              <h2 className="text-sm font-semibold tracking-tight">{s.name}</h2>
              <ul className="mt-2">
                {s.dishes.map((d) => (
                  <li key={d.id} className="border-border flex items-baseline justify-between gap-4 border-b py-2">
                    <div>
                      <p className="text-sm font-semibold">{d.name}</p>
                      {d.kcal != null && (
                        <p className="text-muted-foreground text-[11px] tabular-nums">
                          {d.kcal} kcal · P {d.proteinG ?? "—"}g · C {d.carbsG ?? "—"}g · F {d.fatG ?? "—"}g
                        </p>
                      )}
                      <p className="text-muted-foreground text-[12px]">{d.blurb}</p>
                    </div>
                    <p className="shrink-0 text-sm tabular-nums">{d.table === null ? "—" : money(d.table)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm">The kitchen has not published a menu.</p>
      )}
      <div className="mt-8 flex gap-4">
        <button type="button" className="text-sm underline" onClick={() => window.print()}>
          Print
        </button>
        <Link href={`/places/${place.id}/products/digital-menu`} className="text-sm underline">
          Back to the console
        </Link>
      </div>
    </main>
  );
}
