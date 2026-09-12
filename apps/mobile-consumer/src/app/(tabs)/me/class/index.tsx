import { useRouter } from 'expo-router';
import { ClassModal } from '@/components/me/ClassModal';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';

export default function ClassPage() {
  const router = useRouter();
  return (
    <ClassModal
      visible
      asRoute
      onClose={() => router.back()}
      onConnectInstagram={() =>
        router.push(CONSUMER_ROUTES.mePages.instagram)
      }
    />
  );
}
