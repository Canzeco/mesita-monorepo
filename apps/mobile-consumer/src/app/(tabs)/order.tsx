import { ShoppingBag } from 'lucide-react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { ORDER_RAIL, TabFrame } from '@/components/ui/TabRail';

// Order › Home (MESITA-2050) — web's /order, same copy. The orders vertical is
// designed, not built (Notion Docs › Orders): no table, no Edge Function, no
// type. So this is an honest empty state, never mock places, and no action —
// there is no step toward ordering a guest can take yet.
export default function OrderScreen() {
  return (
    <TabFrame items={ORDER_RAIL} value="home">
      <EmptyState
        icon={ShoppingBag}
        title="Ordering isn't live yet"
        description="Order ahead from places on Mesita, for pickup or delivery. It opens here first."
      />
    </TabFrame>
  );
}
