// Members: roster with role + place scope. Scope null = all places.
import { Users } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { EmptyState } from "@/components/shared/EmptyState";
import { getOrg } from "@/lib/mock";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = getOrg(sp.org);
  const placeName = (id: string) =>
    data.places.find((p) => p.id === id)?.name ?? id;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Members
      </h1>
      {data.members.length <= 1 && data.places.length === 0 ? (
        <EmptyState
          icon={<Users className="text-muted-foreground h-5 w-5" />}
          title="Just you so far"
          description="Invite managers once you have a place — scope them to one location or all of them."
        />
      ) : (
        <Section
          title="Team"
          description="Roles live at the organization; scope decides which places they see."
          right={
            <button type="button" className={PILL_BUTTON_CLASS} disabled>
              Invite (soon)
            </button>
          }
        >
          <div className="flex flex-col">
            {data.members.map((m) => (
              <div
                key={m.id}
                className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-muted-foreground text-[12px]">{m.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold capitalize">{m.role}</p>
                  <p className="text-muted-foreground text-[12px]">
                    {m.placeIds === null
                      ? "All places"
                      : m.placeIds.map(placeName).join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
