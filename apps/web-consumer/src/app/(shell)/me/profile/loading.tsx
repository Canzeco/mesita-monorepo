import { EditProfileSkeleton } from "@/components/consumer/EditProfileSheet";

// /me/profile's fallback: the Profile form's own skeleton, the one
// it draws while its profile read is out, so the route fallback and the
// page's first paint are the same frame (Pato, MESITA-2701: "for example in
// profile the current placeholders are not similar, then fix that").
export default function ProfileLoading() {
  return <EditProfileSkeleton />;
}
