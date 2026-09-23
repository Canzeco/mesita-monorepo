import { Wallet } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { ShellWash } from '@/components/ui/HeroBackdrop';

// The Wallet tab (MESITA-2050) — web's /wallet. No rail: Pato gave Wallet none.
//
// NO BODY YET, and that is the sanctioned divergence, not an oversight. Web's
// wallet sells Credits and saves cards — payment UI, which Apple review keeps
// off this app (this package's CLAUDE.md) — and mobile has no read-only port
// of the balances yet. It also never names the web app: pointing a guest at
// an outside purchase flow is the other half of the same review rule.
export default function WalletScreen() {
  return (
    <ShellWash>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <EmptyState
          icon={Wallet}
          title="Your wallet opens here soon"
          description="Credits you hold at places on Mesita will show up here."
        />
      </SafeAreaView>
    </ShellWash>
  );
}
