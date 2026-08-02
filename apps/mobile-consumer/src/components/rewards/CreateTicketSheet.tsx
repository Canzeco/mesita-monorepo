// "Start a ticket" — mobile mirror of web CreateTicketSheet (Tickets v2,
// MESITA-806): pick the place, optionally opt into the Story bonus
// (Influencer-exclusive), create. Welcome is explained, never a toggle —
// the server detects first visits at billing time.

import {
  BadgeCheck,
  DoorOpen,
  Camera,
  Search,
  Sparkles,
  Star,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { apiSuggestPlaces, type PlacePrediction } from '@/lib/api/places';
import { apiCreateTicket } from '@/lib/api/tickets';
import { newSessionToken } from '@/lib/search-utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

const ELIGIBLE = new Set(['verified_partner_other', 'verified_partner_self']);

export function CreateTicketSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { consumerClass } = useAuth();
  const isInfluencer = (consumerClass?.class ?? 'standard') === 'influencer';

  // Remounted per open by the parent (keyed), so state starts clean.
  const [input, setInput] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PlacePrediction | null>(null);
  const [wantsStory, setWantsStory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef(newSessionToken());

  // Debounced suggest — all setState inside the async timeout callback.
  useEffect(() => {
    if (!visible || picked) return;
    const trimmed = input.trim();
    let cancelled = false;
    const t = setTimeout(
      async () => {
        if (trimmed.length < 2) {
          if (!cancelled) setPredictions([]);
          return;
        }
        if (!cancelled) setSearching(true);
        try {
          const rows = await apiSuggestPlaces(
            supabase,
            trimmed,
            sessionTokenRef.current,
          );
          if (!cancelled) setPredictions(rows);
        } catch {
          if (!cancelled) setPredictions([]);
        } finally {
          if (!cancelled) setSearching(false);
        }
      },
      trimmed.length < 2 ? 0 : 300,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [input, visible, picked]);

  const eligible = useMemo(
    () =>
      predictions.filter(
        (p) => ELIGIBLE.has(p.status) && (p.mesitaId || p.mesitaSlug),
      ),
    [predictions],
  );

  const create = useCallback(async () => {
    if (!picked?.mesitaId) return;
    setCreating(true);
    setError(null);
    try {
      await apiCreateTicket(picked.mesitaId, wantsStory);
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the ticket.");
    } finally {
      setCreating(false);
    }
  }, [picked, wantsStory, onCreated, onClose]);

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Start a ticket"
      subtitle="Pick the place — your QR is the ticket."
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Place picker */}
        {picked ? (
          <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
            <BadgeCheck size={20} color="#059669" />
            <View className="min-w-0 flex-1">
              <Text className="font-bold text-foreground" numberOfLines={1} style={{ fontSize: 14 }}>
                {picked.mainText}
              </Text>
              <Text className="text-muted-foreground" numberOfLines={1} style={{ fontSize: 11 }}>
                {picked.secondaryText}
              </Text>
            </View>
            <Pressable onPress={() => setPicked(null)} accessibilityRole="button">
              <Text className="font-semibold text-muted-foreground underline" style={{ fontSize: 12 }}>
                Change
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3.5">
              <Search size={16} color="#775254" />
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Search the place you're visiting"
                placeholderTextColor="#a08486"
                className="flex-1 text-foreground"
                style={{ height: 44, fontSize: 14 }}
              />
              {searching ? <ActivityIndicator size="small" /> : null}
            </View>
            {eligible.length > 0 ? (
              <View className="overflow-hidden rounded-2xl border border-border bg-card">
                {eligible.slice(0, 5).map((p, i) => (
                  <Pressable
                    key={p.placeId}
                    onPress={() => setPicked(p)}
                    className={`flex-row items-center gap-2.5 px-3.5 py-2.5 active:bg-muted/50 ${
                      i > 0 ? 'border-t border-border' : ''
                    }`}
                  >
                    <BadgeCheck size={16} color="#059669" />
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold text-foreground" numberOfLines={1} style={{ fontSize: 13.5 }}>
                        {p.mainText}
                      </Text>
                      <Text className="text-muted-foreground" numberOfLines={1} style={{ fontSize: 11 }}>
                        {p.secondaryText}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : input.trim().length >= 2 && !searching ? (
              <Text className="px-1 text-muted-foreground" style={{ fontSize: 12 }}>
                No Verified Partners match — only Verified places run Mesita rewards.
              </Text>
            ) : null}
          </View>
        )}

        {/* Bonuses */}
        <View style={{ gap: 8 }}>
          <Text
            className="font-bold uppercase text-muted-foreground"
            style={{ fontSize: 10, letterSpacing: 1.4 }}
          >
            Your bonuses
          </Text>

          <View className="flex-row items-start gap-3 rounded-2xl border border-border px-3.5 py-3">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
              <DoorOpen size={16} color="#cf0360" />
            </View>
            <Text className="flex-1 text-muted-foreground" style={{ fontSize: 12, lineHeight: 17 }}>
              <Text className="font-semibold text-foreground">Welcome Visit. </Text>
              Applied automatically if it&apos;s your first time at this place —
              nothing to select.
            </Text>
          </View>

          {isInfluencer ? (
            <Pressable
              onPress={() => setWantsStory((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: wantsStory }}
              className={`flex-row items-start gap-3 rounded-2xl border px-3.5 py-3 ${
                wantsStory ? 'border-secondary/40 bg-secondary/5' : 'border-border'
              }`}
            >
              <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
                <Camera size={16} color="#cf0360" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-foreground" style={{ fontSize: 13 }}>
                  Instagram Story — yours alone
                </Text>
                <Text className="text-muted-foreground" style={{ fontSize: 12, lineHeight: 17 }}>
                  Post a tagged story at the table for a bigger reward.
                </Text>
              </View>
              <View
                className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border ${
                  wantsStory ? 'border-secondary bg-secondary' : 'border-border'
                }`}
              >
                {wantsStory ? (
                  <Text className="font-bold text-white" style={{ fontSize: 10 }}>
                    ✓
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ) : null}

          <View className="flex-row items-start gap-3 rounded-2xl border border-border px-3.5 py-3">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
              <Star size={16} color="#cf0360" />
            </View>
            <Text className="flex-1 text-muted-foreground" style={{ fontSize: 12, lineHeight: 17 }}>
              <Text className="font-semibold text-foreground">Google Review. </Text>
              Available at the table, once per place — you can add it during the
              visit.
            </Text>
          </View>
        </View>

        {error ? (
          <Text
            className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
            style={{ fontSize: 12.5 }}
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          disabled={!picked?.mesitaId || creating}
          onPress={() => void create()}
          className={`items-center rounded-xl px-4 py-3.5 ${
            !picked?.mesitaId || creating ? 'opacity-50' : 'active:opacity-90'
          }`}
          style={{ backgroundColor: '#e91f64' }}
        >
          <View className="flex-row items-center gap-2">
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Sparkles size={16} color="#fff" />
            )}
            <Text className="font-semibold text-white" style={{ fontSize: 14 }}>
              Create my ticket
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </FullScreenSheet>
  );
}
