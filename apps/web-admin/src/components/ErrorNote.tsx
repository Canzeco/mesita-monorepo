import { Notice } from "@/components/admin-ui/notice";

/** @deprecated use { Notice } from "@/components/admin-ui" (tone="error"). */
export function ErrorNote({ message }: { message: string }) {
  return <Notice className="mt-4">{message}</Notice>;
}
