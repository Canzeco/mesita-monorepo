import { ClassModal } from "@/components/consumer/me/ClassModal";

// /me/class — what a class is for, Regular and VIP, both Soon (MESITA-3099).
// Nothing on it depends on the guest, so it reads nothing.
export default function Page() {
  return <ClassModal />;
}
