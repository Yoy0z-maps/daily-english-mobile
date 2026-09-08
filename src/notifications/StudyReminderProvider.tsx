import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { type PropsWithChildren, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { getLocalDateKey, useAppStore } from '@/store/useAppStore';
import { useLearningSync } from '@/sync/LearningSyncProvider';
import { supportsStudyReminders, syncStudyReminders } from './studyReminders';

export function StudyReminderProvider({ children }: PropsWithChildren) {
  const { session, isReady } = useAuth();
  const { lastSyncedAt } = useLearningSync();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const enabled = useAppStore((state) => state.notificationsEnabled);
  const history = useAppStore((state) => state.completedHistory);
  const lastCompletedDate = useAppStore((state) => state.lastCompletedDate);
  const activeUser = useRef(session?.user.id);
  activeUser.current = session?.user.id;

  useEffect(() => {
    if (!supportsStudyReminders) return;
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const state = useAppStore.getState();
        const isReminder = notification.request.content.data?.kind === 'study-reminder';
        const show = !isReminder || Boolean(activeUser.current && state.notificationsEnabled &&
          state.lastCompletedDate !== getLocalDateKey() &&
          !state.completedHistory.some((entry) => entry.completedDate === getLocalDateKey()));
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
      }
    });
    return () => Notifications.setNotificationHandler(null);
  }, []);

  useEffect(() => {
    if (!supportsStudyReminders || !isReady || !hasHydrated) return;
    // Avoid replacing valid pending reminders with an empty, not-yet-synced learning cache.
    if (session && enabled && !lastSyncedAt) return;
    const refresh = () => {
      void syncStudyReminders(() => {
        const state = useAppStore.getState();
        return {
          enabled: Boolean(activeUser.current) && state.notificationsEnabled,
          completedDates: [...state.completedHistory.map((entry) => entry.completedDate),
            ...(state.lastCompletedDate ? [state.lastCompletedDate] : [])]
        };
      }).catch((error) => {
        console.warn('학습 알림 예약 실패', error);
        Alert.alert('학습 알림 설정 실패', '알림을 예약하지 못했어요. 설정에서 학습 알림을 다시 켜 주세요.');
      });
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    // Also refresh across midnight when the app remains open.
    const interval = setInterval(refresh, 60_000);
    return () => { subscription.remove(); clearInterval(interval); };
  }, [isReady, hasHydrated, session?.user.id, enabled, history, lastCompletedDate, lastSyncedAt]);

  useEffect(() => {
    if (!supportsStudyReminders || !isReady || !hasHydrated || !session) return;
    const openReminder = (response: Notifications.NotificationResponse) => {
      if (response.notification.request.content.data?.kind !== 'study-reminder') return;
      router.push('/(tabs)/home');
      void Notifications.clearLastNotificationResponseAsync().catch((error) => {
        console.warn('알림 응답 초기화 실패', error);
      });
    };
    let mounted = true;
    const subscription = Notifications.addNotificationResponseReceivedListener(openReminder);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (mounted && response) openReminder(response);
    }).catch((error) => console.warn('알림 응답 확인 실패', error));
    return () => { mounted = false; subscription.remove(); };
  }, [isReady, hasHydrated, session?.user.id]);

  return children;
}
