import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { buildReminderPlan, REMINDER_PREFIX } from './reminderPlan';

const CHANNEL_ID = 'study-reminders';
const REMINDER_CONTENT = {
  title: '오늘의 한 문장이 기다려요',
  body: '오늘은 아직 학습 전이에요. 한 문장만 잠깐 공부하고 갈까요?',
  sound: 'default'
};

export const supportsStudyReminders = Platform.OS === 'ios' || Platform.OS === 'android';

export async function hasReminderPermission() {
  if (!supportsStudyReminders) return false;
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function requestReminderPermission() {
  if (!supportsStudyReminders) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '매일 학습 알림',
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }
  await Notifications.requestPermissionsAsync();
  return hasReminderPermission();
}

type ReminderState = { enabled: boolean; completedDates: string[] };
let pending: Promise<void> = Promise.resolve();

// Serialize native updates and read the latest state when each operation starts.
export function syncStudyReminders(getState: () => ReminderState) {
  const task = pending.catch(() => undefined).then(async () => {
    if (!supportsStudyReminders) return;
    // Request once after login when reminders are enabled. A denial must be
    // changed explicitly in Settings, rather than prompting on every refresh.
    const permission = await Notifications.getPermissionsAsync();
    const permitted = getState().enabled && permission.status === 'undetermined'
      ? await requestReminderPermission()
      : permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    const state = getState();
    const plan = state.enabled && permitted ? buildReminderPlan(state.completedDates) : [];
    const desired = new Set(plan.map(({ identifier }) => identifier));
    const existing = (await Notifications.getAllScheduledNotificationsAsync())
      .filter(({ identifier }) => identifier.startsWith(REMINDER_PREFIX));
    for (const item of existing) {
      if (!desired.has(item.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
    const scheduled = new Set(existing.map(({ identifier }) => identifier));
    for (const item of plan) {
      if (scheduled.has(item.identifier)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: item.identifier,
        content: {
          ...REMINDER_CONTENT,
          data: { kind: 'study-reminder' }
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId: CHANNEL_ID }
      });
    }
  });
  pending = task;
  return task;
}
