// Legacy path while the app briefly lived at /check/<code> before the
// MESITA-814 root flip. Keep forever so a bookmarked intermediate URL still
// opens the ticket.
import { redirect } from "next/navigation";

export default async function LegacyCheckPathRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/${encodeURIComponent(code)}`);
}
