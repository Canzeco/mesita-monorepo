import { FeedbackModal } from "@/components/consumer/me/FeedbackModal";

// /me/settings/feedback — feedback about the app itself (MESITA-3029).
export const dynamic = "force-dynamic";

export default function Page() {
  return <FeedbackModal />;
}
