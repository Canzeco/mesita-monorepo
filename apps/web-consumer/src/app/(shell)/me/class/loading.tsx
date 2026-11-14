import { ClassModal } from "@/components/consumer/me/ClassModal";

// /me/class' fallback (Pato, MESITA-2701: "the placeholders must be similar
// to the page you are loading"). The page itself is the fallback: its status
// card draws its own placeholder until the profile row is there (MESITA-3873).
export default function ClassLoading() {
  return <ClassModal />;
}
