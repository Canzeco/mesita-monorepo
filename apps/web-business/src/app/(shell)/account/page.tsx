// Account: the signed-in human. Mock era: a stub — no session exists.
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { getOrg } from "@/lib/mock";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const owner = getOrg(sp.org).members.find((m) => m.role === "owner");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Account
      </h1>
      <Section
        title="You"
        description="Sign-in returns when real data lands — this is the mock era."
        right={
          <button type="button" className={PILL_BUTTON_CLASS} disabled>
            Sign out (soon)
          </button>
        }
      >
        <div>
          <DataRow label="Name">{owner?.name ?? "—"}</DataRow>
          <DataRow label="Email">{owner?.email ?? "—"}</DataRow>
        </div>
      </Section>
    </>
  );
}
