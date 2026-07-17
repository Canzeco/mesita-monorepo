import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUp, Sparkles } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';

export function AskAiComposer({
  related,
  thinking,
  input,
  onChangeText,
  onSend,
}: {
  related: string[];
  thinking: boolean;
  input: string;
  onChangeText: (text: string) => void;
  onSend: (raw?: string) => void;
}) {
  return (
    <>
      {related.length > 0 && !thinking ? (
        <View className="flex-row flex-wrap gap-1.5 border-t border-border px-3 pt-2">
          {related.map((q) => (
            <Pressable
              key={q}
              onPress={() => onSend(q)}
              className="max-w-full rounded-full border border-border bg-muted/50 px-3 py-1"
            >
              <Text className="text-xs text-foreground" numberOfLines={1}>
                {q}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View className="border-t border-border bg-background/80 p-2">
        <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
          <Sparkles color="#fb2b7b" size={16} />
          <TextInput
            value={input}
            onChangeText={onChangeText}
            placeholder="Ask anything…"
            placeholderTextColor="#77525499"
            className="min-w-0 flex-1 py-1 text-sm text-foreground"
            editable={!thinking}
            onSubmitEditing={() => onSend()}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => onSend()}
            disabled={!input.trim() || thinking}
            accessibilityLabel="Send"
            className="active:opacity-90 disabled:opacity-40"
          >
            <LinearGradient
              colors={[...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowUp color="#fff" size={16} />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </>
  );
}
