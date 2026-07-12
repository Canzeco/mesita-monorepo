import { Redirect } from 'expo-router';

/** Default inbox landing — mirrors web `/inbox` → `/inbox/mine`. */
export default function InboxIndex() {
  return <Redirect href="/inbox/mine" />;
}
