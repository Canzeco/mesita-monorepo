import { ProfileTab } from "@/components/place-manage/ProfileTab";

// Held, always (access.ts): the pool branch business's PlaceProfileBody keeps
// for an unclaimed place has no reader here.
export default function AdminPlaceProfilePage() {
  return <ProfileTab />;
}
