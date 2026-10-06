"use client";

// The place's own site. Books and orders go back to Mesita; the menu is the
// published Digital Menu. A site that is not published yet says so.
import { use } from "react";
import Link from "next/link";
import { publishedSectionsOf } from "@/mock/desk";
import { useMock } from "@/mock/MockStore";
import { money } from "@/lib/format";
import { productKeyHref } from "@/lib/product-routes";

export default function ExpressSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { world, desk } = useMock();
  const place = world.places.find((p) => p.id === `plc_${slug}` || p.id === slug);

  if (!place) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <p className="text-sm">No site at this address.</p>
      </main>
    );
  }

  const live = place.websiteState === "published";
  const sections = publishedSectionsOf(place.id, place.menuPublishedAt, desk);
  const host = place.websiteDomain ?? `${slug}.mesita.co`;

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">{host}</p>
      <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">{place.name}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{place.city}</p>
      {!live && (
        <p className="bg-muted mt-4 rounded-lg px-3 py-2 text-sm" role="status">
          This site is not public yet. Publish it from Express Website.
        </p>
      )}
      <p className="mt-4">
        <Link href={`/places/${place.id}/products/express-website`} className="text-sm underline">
          Back to the console
        </Link>
      </p>
      <div className="mt-5 flex gap-2">
        <Link href={productKeyHref(place.id, "products", "reservations")} className="rounded-full border px-3 py-1.5 text-[13px] font-semibold">
          Book a table
        </Link>
        <Link href={productKeyHref(place.id, "products", "orders")} className="rounded-full border px-3 py-1.5 text-[13px] font-semibold">
          Order
        </Link>
      </div>
      <div className="mt-8 flex flex-col gap-6">
        {sections.length === 0 && <p className="text-muted-foreground text-sm">The menu has not been published.</p>}
        {sections.map((s) => (
          <section key={s.id}>
            <h2 className="text-sm font-semibold">{s.name}</h2>
            <ul>
              {s.dishes.map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-3 border-b py-1.5 text-sm">
                  <span>{d.name}</span>
                  <span className="tabular-nums">{d.table === null ? "—" : money(d.table)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
