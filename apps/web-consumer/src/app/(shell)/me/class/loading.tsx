import { ClassModal } from "@/components/consumer/me/ClassModal";

// The page reads only the shell's seeded profile: it is its own fallback
// (MESITA-2701).
export default function ClassLoading() {
  return <ClassModal />;
}
