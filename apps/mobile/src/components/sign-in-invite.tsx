import { EmptyState } from "@/components/empty-state";

/** A member tab for a visitor: what it is for, and Sign in. */
export function SignInInvite({ message, onSignIn }: { message: string; onSignIn: () => void }) {
  return <EmptyState message={message} action={{ label: "Sign in", onPress: onSignIn }} />;
}
