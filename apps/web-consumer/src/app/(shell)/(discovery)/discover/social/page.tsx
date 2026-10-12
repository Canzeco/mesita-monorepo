import { Users } from "lucide-react";
import { HomeSoon } from "@/components/consumer/home/HomeSoon";

// SOCIAL — Soon (MESITA-2168). Nothing social exists yet: no follows, no
// posts, no shared lists. The page says so rather than painting sample people.
export default function DiscoverSocialPage() {
  return (
    <HomeSoon
      icon={Users}
      name="Social"
      description="Seeing where friends go lands here shortly — thanks for waiting."
    />
  );
}
