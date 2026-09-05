// Places — the catalog layer. Lists EVERY place on the platform, not just
// the ones you are a member of, and hands off to the real per-place
// console at /place/[id]/place. Reads through admin-web-search-places
// (super-admin), so this page needs a super-admin session; the writes it
// leads to are ordinary business-web-* calls that bypass membership for
// super-admins.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Store } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageErrorState } from "@/components/business/PageErrorState";
import { createServerSupabase } from "@/lib/supabase/server";
import { searchAnyPlaces, type CatalogPlace } from "@/lib/api/catalog";
import { placePath } from "@/lib/business-route-contract";
import { errMsg } from "@/lib/utils";
import { INPUT_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// PLACE states, read straight off the catalogue row. Partner is NOT here:
// it is a property of the organization that operates the place (does it
// have a live payment account), so it cannot be a per-place badge.
function Flag({ on, label }: { on: boolean; label: string }) {
  if (!on) return null;
  return (
    <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[11px]">
      {label}
    </span>
  );
}

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/places");

  let places: CatalogPlace[] = [];
  let error: string | null = null;
  try {
    places = await searchAnyPlaces(supabase, query);
  } catch (e) {
    error = errMsg(e, "Couldn't load the place catalog.");
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className={TINY_LABEL_CLASS}>Manage any place</span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Places
        </h1>
      </div>

      <form action="/places" className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name or address..."
          aria-label="Search places"
          className={cn(INPUT_CLASS, "pl-9")}
        />
      </form>

      {error ? (
        <PageErrorState
          heading="Couldn't load the catalog"
          message={error}
          retryHref="/places"
        />
      ) : places.length === 0 ? (
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title={query ? "No places match that" : "No places yet"}
          description={
            query
              ? "Try a different name, or clear the search to see the whole catalog."
              : "The catalog is empty."
          }
        />
      ) : (
        <div className="border-border bg-card rounded-2xl border px-4">
          {places.map((p) => (
            <Link
              key={p.id}
              href={placePath(p.id)}
              className="border-border/60 hover:bg-muted/40 -mx-4 flex items-center justify-between gap-3 border-b px-4 py-3.5 transition last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="text-muted-foreground truncate text-[12px]">
                  {p.address ?? p.zone ?? "No address"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Flag on={p.listed} label="Listed" />
                <Flag on={p.verified} label="Verified" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
