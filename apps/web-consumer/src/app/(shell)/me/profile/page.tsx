import { EditProfileSheet } from "@/components/consumer/EditProfileSheet";

// /me/profile — personal details. Was a nested LocalSheet (MESITA-1789).
export const dynamic = "force-dynamic";

export default function Page() {
  return <EditProfileSheet />;
}
