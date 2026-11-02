import { ClassModal } from "@/components/consumer/me/ClassModal";

// /me/class' fallback (Pato, MESITA-2701: "the placeholders must be similar
// to the page you are loading"). Class is Soon (MESITA-3099): the page reads
// nothing, so its fallback is the page itself.
export default function ClassLoading() {
  return <ClassModal />;
}
