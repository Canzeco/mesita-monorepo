import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MessageCircle, Phone, Sparkles } from 'lucide-react-native';

import { ComingSoonModal } from '@/components/ui/ComingSoonModal';
import { COLORS } from '@/constants/brand';

// Mirrors web `components/consumer/home/MemoModeHeader.tsx` (MESITA-1102) —
// Don Memo, and the two ways to reach him.
//
// Memo used to be one thing, so the Home pill said "Chat" and the screen below
// was the thread top to bottom. It is two things now — CALL him or TYPE at him
// — and a mode with two ways in has to say so before you start. Call leads
// because it is the one a guest wouldn't guess.
//
// CALL IS ANNOUNCED, NOT WIRED (Pato, live: "announced only, for now"): no
// Memo voice agent and no number exist behind it. It stays visible because the
// two-way shape IS the product statement, and it opens the coming-soon modal —
// no "soon" badges anywhere in this app (MESITA-601).
export function MemoModeHeader() {
  const [callSoon, setCallSoon] = useState(false);

  return (
    <>
      <View className="shrink-0 border-b border-border bg-background px-3 py-2.5">
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles color={COLORS.primary} size={18} strokeWidth={2.2} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-foreground">
              Don Memo
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              Your Mesita concierge
            </Text>
          </View>
        </View>

        <View className="mt-2.5 flex-row gap-1.5">
          <Pressable
            onPress={() => setCallSoon(true)}
            accessibilityRole="button"
            accessibilityLabel="Call Don Memo"
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border bg-card py-2 active:opacity-80"
          >
            <Phone color={COLORS.mutedForeground} size={14} strokeWidth={2.2} />
            <Text className="text-xs font-semibold text-muted-foreground">
              Call
            </Text>
          </Pressable>

          {/* Not pressable: Chat is where you already are, and a control that
              can only re-select the current state is a dead tap. It renders as
              the selected segment so the pair reads as a switch. */}
          <View className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary py-2">
            <MessageCircle
              color={COLORS.primaryForeground}
              size={14}
              strokeWidth={2.2}
            />
            <Text className="text-xs font-semibold text-primary-foreground">
              Chat
            </Text>
          </View>
        </View>
      </View>

      <ComingSoonModal
        open={callSoon}
        onClose={() => setCallSoon(false)}
        title="Calling Don Memo"
        body="Soon you'll be able to call Don Memo and just say what you're in the mood for — he'll talk you to a table. Until then he's right here, in chat."
        icon={Phone}
      />
    </>
  );
}
