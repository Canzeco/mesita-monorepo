import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { RotateCcw } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { AskAiComposer } from '@/components/memo/ask-ai-composer';
import { MemoAnswerText } from '@/components/memo/MemoAnswerText';
import type { AddState } from '@/components/memo/types';
import {
  buildAiReply,
  buildMemoHistory,
  clearThreadCache,
  getThreadCache,
  greetingThread,
  msgId,
  saveThreadCache,
  type AiMessage,
} from '@/components/memo/ask-ai-thread';
import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import type { MemoAnswer, MemoTurn } from '@/lib/api/memo';
import type { Place, PlacePrediction } from '@/lib/api/places';

const DRAFT_KEY = 'mesita:memo-draft';

export function AskAiPanel({
  ask,
  addStates,
  resolvePlace,
  onInfo,
  onAdd,
}: {
  ask: (text: string, history: MemoTurn[]) => Promise<MemoAnswer>;
  addStates: Record<string, AddState>;
  resolvePlace: (prediction: PlacePrediction) => Place | null;
  onInfo: (prediction: PlacePrediction) => void;
  onAdd: (prediction: PlacePrediction) => void;
}) {
  const [messages, setMessages] = useState<AiMessage[]>(
    () => getThreadCache()?.messages ?? greetingThread(),
  );
  const [input, setInput] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [related, setRelated] = useState<string[]>(
    () => getThreadCache()?.related ?? [],
  );
  const scrollRef = useRef<ScrollView>(null);

  // Draft composer → AsyncStorage (issue: localStorage draft/prefs → AsyncStorage).
  // Thread stays session-only module cache (web parity — reload starts fresh).
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (cancelled) return;
      if (raw) setInput(raw);
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    void AsyncStorage.setItem(DRAFT_KEY, input).catch(() => undefined);
  }, [input, draftReady]);

  useEffect(() => {
    saveThreadCache(messages, related);
  }, [messages, related]);

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [messages, thinking, related]);

  const clearThread = () => {
    setMessages(greetingThread());
    setRelated([]);
    setInput('');
    clearThreadCache();
    void AsyncStorage.removeItem(DRAFT_KEY);
  };

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || thinking) return;
    setInput('');
    void AsyncStorage.removeItem(DRAFT_KEY);
    setRelated([]);

    const history = buildMemoHistory(messages);

    setMessages((m) => [
      ...m,
      { id: msgId(), role: 'user', kind: 'text', text },
    ]);
    setThinking(true);
    void (async () => {
      let reply: MemoAnswer | null = null;
      try {
        reply = await ask(text, history);
      } catch {
        reply = null;
      }
      const aiReply = buildAiReply(reply);
      setMessages((m) => [
        ...m,
        aiReply.message,
      ]);
      setRelated(aiReply.related);
      setThinking(false);
    })();
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View className="relative min-h-0 flex-1">
        {messages.length > 1 ? (
          <Pressable
            onPress={clearThread}
            accessibilityLabel="Clear chat"
            className="absolute top-2 right-2 z-10 flex-row items-center gap-1 rounded-full border border-border bg-background/90 px-2.5 py-1.5"
          >
            <RotateCcw color="#775254" size={14} />
            <Text className="text-xs text-muted-foreground">Clear</Text>
          </Pressable>
        ) : null}

        <ScrollView
          ref={scrollRef}
          className="min-h-0 flex-1"
          contentContainerClassName="gap-2 p-3 pb-4"
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => {
            const isUser = m.role === 'user';
            const hasPlaces = !isUser && (m.predictions?.length ?? 0) > 0;
            return (
              <View
                key={m.id}
                className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {isUser ? (
                  <LinearGradient
                    colors={[...GRADIENTS.pink]}
                    start={GRADIENT_DIAGONAL.start}
                    end={GRADIENT_DIAGONAL.end}
                    style={{
                      maxWidth: '82%',
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text className="text-sm leading-relaxed text-white">
                      {m.text}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View className="max-w-[82%] rounded-2xl border border-border bg-card px-3 py-2">
                    {hasPlaces ? (
                      <MemoAnswerText
                        text={m.text}
                        predictions={m.predictions ?? []}
                        resolvePlace={resolvePlace}
                        addStates={addStates}
                        onInfo={onInfo}
                        onAdd={onAdd}
                      />
                    ) : (
                      <Text className="text-sm leading-relaxed text-foreground">
                        {m.text}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          {thinking ? (
            <View className="flex-row justify-start">
              <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
                <ActivityIndicator color="#fb2b7b" size="small" />
                <Text className="text-sm text-muted-foreground">Thinking…</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <AskAiComposer
          related={related}
          thinking={thinking}
          input={input}
          onChangeText={setInput}
          onSend={send}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
