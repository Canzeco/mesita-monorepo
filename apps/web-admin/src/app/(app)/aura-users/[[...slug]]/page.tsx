import { permanentRedirect } from "next/navigation";

// /aura-users → /aura-consumers (2026-08-09). The page spent one deploy under
// "users" before the house word won: Mesita's guest side is CONSUMERS, never
// users. Short-lived, but it reached production, so it gets a shim like the
// rest.
export default async function AuraUsersLegacyRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  permanentRedirect(
    `/aura-consumers${slug?.length ? `/${slug.join("/")}` : ""}`,
  );
}
