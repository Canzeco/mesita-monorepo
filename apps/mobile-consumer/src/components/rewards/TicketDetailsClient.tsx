import { useRouter } from 'expo-router';
import {
  ChevronLeft,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { TicketReviewDraft } from '@/components/rewards/TicketReviewForm';
import {
  fetchPayTicketBundle,
  type PayTicketMeta,
} from '@/lib/api/notifications';
import {
  buildTicketTransactionSummary,
  formatTicketRewardLabel,
  formatTicketTransactionSummaryLine,
  formatTicketVisitDate,
  MOCK_STORY_DETECT_ENABLED,
  mockStoryDetect,
  payloadFromNotification,
  resolvePlaceInstagramHandle,
  submitTicketReview,
  type PayNotificationRow,
  type TicketBillPayload,
} from '@/lib/api/pay';
import {
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  STEP_NOW_TITLE,
  ticketProgressFromBundle,
  type TicketFlowStepId,
} from '@/lib/ticket-flow-steps';
import { ActionCard } from '@/components/rewards/ActionCard';
import { TicketDetailsSkeleton } from '@/components/rewards/TicketDetailsSkeleton';
import { VisitComplete } from '@/components/rewards/VisitComplete';
import { VisitHeader } from '@/components/rewards/VisitHeader';
import { renderStepActions } from '@/components/rewards/renderStepActions';
import { errMsg } from '@/lib/utils';

export function TicketDetailsClient({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<PayNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketMeta, setTicketMeta] = useState<PayTicketMeta | null>(null);
  const [placeInstagramUrl, setPlaceInstagramUrl] = useState<string | null>(
    null,
  );
  const [reviewDraft, setReviewDraft] = useState<TicketReviewDraft>({
    food: 0,
    service: 0,
    ambiance: 0,
    value: 0,
    overall: 0,
    comments: '',
  });
  const [peekStepId, setPeekStepId] = useState<TicketFlowStepId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { notifications, ticketMeta: meta, placeInstagramUrl: ig } =
        await fetchPayTicketBundle(ticketId);
      setRows(notifications);
      setTicketMeta(meta);
      setPlaceInstagramUrl(ig);
      setError(null);
    } catch (e) {
      setError(errMsg(e, "Couldn’t load ticket."));
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { notifications, ticketMeta: meta, placeInstagramUrl: ig } =
          await fetchPayTicketBundle(ticketId);
        if (cancelled) return;
        setRows(notifications);
        setTicketMeta(meta);
        setPlaceInstagramUrl(ig);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(errMsg(e, "Couldn’t load ticket."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const payload = useMemo<TicketBillPayload>(() => {
    const merged: TicketBillPayload = {};
    for (const row of rows)
      Object.assign(merged, payloadFromNotification(row.payload));
    return merged;
  }, [rows]);

  const ticketKind = ticketMeta?.kind ?? payload.ticket_kind ?? 'dp';
  const reviewNotification = rows.find((r) => r.kind === 'review');
  const billNotification = rows.find((r) => r.kind === 'bill');

  const progress = useMemo(
    () =>
      ticketProgressFromBundle({
        kind: ticketKind,
        status: ticketMeta?.status,
        story_status: ticketMeta?.story_status,
        story_submitted_at: ticketMeta?.story_submitted_at,
        total_cents: ticketMeta?.total_cents ?? payload.total_cents,
        review: reviewNotification,
      }),
    [ticketKind, ticketMeta, payload.total_cents, reviewNotification],
  );

  const isComplete = isTicketFlowComplete(progress);
  const flowSteps = useMemo(() => resolveTicketFlowSteps(progress), [progress]);
  const activeStep = flowSteps.find((s) => s.state === 'active');

  const displayStepId: TicketFlowStepId = useMemo(() => {
    if (peekStepId && flowSteps.some((s) => s.id === peekStepId)) {
      const peek = flowSteps.find((s) => s.id === peekStepId)!;
      if (peek.state !== 'upcoming') return peekStepId;
    }
    return activeStep?.id ?? flowSteps[flowSteps.length - 1]?.id ?? 'scan';
  }, [peekStepId, activeStep, flowSteps]);

  const displayStep = flowSteps.find((s) => s.id === displayStepId);

  const transactionSummary = useMemo(() => {
    return isComplete
      ? buildTicketTransactionSummary(payload, ticketKind)
      : null;
  }, [isComplete, payload, ticketKind]);

  const visitDateIso =
    ticketMeta?.created_at ??
    billNotification?.created_at ??
    rows[0]?.created_at ??
    null;
  const placeName = payload.place_name ?? 'Partner place';
  const placeHref = payload.place_slug ?? payload.project_id ?? null;
  const visitDateLabel = formatTicketVisitDate(visitDateIso);
  const capMxn = payload.reward_cap_mxn ?? payload.monthly_promo_cap ?? null;
  const rewardLabel = formatTicketRewardLabel(payload, { capMxn });
  const placeInstagramHandle = useMemo(
    () => resolvePlaceInstagramHandle(payload, placeInstagramUrl),
    [payload, placeInstagramUrl],
  );

  const statusLine = useMemo(() => {
    if (isComplete) return null;
    const active = flowSteps.find((s) => s.state === 'active');
    if (!active) return null;
    return `${STEP_NOW_TITLE[active.id]} — in progress`;
  }, [isComplete, flowSteps]);

  const handleStepSelect = (id: TicketFlowStepId) => {
    const step = flowSteps.find((s) => s.id === id);
    if (!step || step.state === 'upcoming') return;
    if (step.state === 'active') setPeekStepId(null);
    else setPeekStepId(id);
  };

  const onMockStoryDetect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await mockStoryDetect(ticketId);
      await load();
    } catch (e) {
      setError(errMsg(e, "Couldn’t simulate story detection."));
    } finally {
      setBusy(false);
    }
  }, [ticketId, load]);

  const onReview = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await submitTicketReview({
        ticketId,
        ...reviewDraft,
        comments: reviewDraft.comments.trim() || undefined,
      });
      await load();
    } catch (e) {
      setError(errMsg(e, "Couldn’t submit review."));
    } finally {
      setBusy(false);
    }
  }, [ticketId, reviewDraft, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff7f8' }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back to tickets"
          style={{
            borderRadius: 999,
            padding: 8,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#ebd9db',
          }}
        >
          <ChevronLeft color="#260409" size={16} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#260409' }}>
          Your visit
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 32,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <TicketDetailsSkeleton />
        ) : (
          <>
            <VisitHeader
              placeName={placeName}
              placeHref={placeHref}
              placePhotoUrl={payload.place_photo_url}
              rewardLabel={rewardLabel}
              visitDateLabel={visitDateLabel}
              steps={flowSteps}
              displayStepId={displayStepId}
              onStepSelect={isComplete ? undefined : handleStepSelect}
              transactionSummaryLine={
                transactionSummary
                  ? formatTicketTransactionSummaryLine(transactionSummary)
                  : null
              }
              statusLine={statusLine}
            />

            {isComplete && transactionSummary ? (
              <VisitComplete />
            ) : displayStep ? (
              <ActionCard
                step={displayStep}
                progress={progress}
                payload={payload}
                ticketKind={ticketKind}
                capMxn={capMxn}
                placeInstagramHandle={placeInstagramHandle}
                onShowQr={() => router.push('/(tabs)/rewards')}
              >
                {renderStepActions({
                  step: displayStep,
                  busy,
                  reviewDraft,
                  onReviewDraftChange: setReviewDraft,
                  onSubmitReview: () => void onReview(),
                  onMockStoryDetect: () => void onMockStoryDetect(),
                  showMockStoryButton: MOCK_STORY_DETECT_ENABLED,
                })}
              </ActionCard>
            ) : null}

            {error ? (
              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: 'rgba(220,38,38,0.08)',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: '#dc2626', fontSize: 14 }}>{error}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
