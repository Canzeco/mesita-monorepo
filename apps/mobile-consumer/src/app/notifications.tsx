import { Redirect } from 'expo-router';

/** Legacy web `/notifications` → inbox mine (parity). */
export default function NotificationsRedirect() {
  return <Redirect href="/inbox/mine" />;
}
