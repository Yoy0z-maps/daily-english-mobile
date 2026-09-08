import * as Notifications from 'expo-notifications';
import { buildReminderPlan, REMINDER_PREFIX } from '@/notifications/reminderPlan';
import { syncStudyReminders } from '@/notifications/studyReminders';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { DEFAULT: 3 },
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' }
}));

describe('study reminders', () => {
  const now = new Date(2026, 8, 8, 19, 0);
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as never);
    jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it('requests undecided permission for enabled reminders after login', async () => {
    jest.mocked(Notifications.getPermissionsAsync)
      .mockResolvedValueOnce({ granted: false, status: 'undetermined' } as never);
    await syncStudyReminders(() => ({ enabled: true, completedDates: [] }));
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(60);
  });

  it.each([
    [false, 'undetermined'],
    [true, 'denied']
  ])('does not automatically prompt when enabled=%s and status=%s', async (enabled, status) => {
    jest.mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ granted: false, status } as never);
    await syncStudyReminders(() => ({ enabled: Boolean(enabled), completedDates: [] }));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules 20:00 locally and skips completed days', () => {
    const plan = buildReminderPlan(['2026-09-08'], now);
    expect(plan).toHaveLength(59);
    expect(plan[0].date).toEqual(new Date(2026, 8, 9, 20));
    expect(plan.every(({ date }) => date.getHours() === 20 && date.getMinutes() === 0)).toBe(true);
  });

  it('does not send a late reminder at or after 20:00', () => {
    for (const hour of [20, 21, 23]) {
      expect(buildReminderPlan([], new Date(2026, 8, 8, hour))[0].date).toEqual(new Date(2026, 8, 9, 20));
    }
    expect(buildReminderPlan([], new Date(2026, 11, 31, 21))[0].date).toEqual(new Date(2027, 0, 1, 20));
  });

  it('cancels today after completion while keeping future and unrelated notifications', async () => {
    const plan = buildReminderPlan([], now);
    jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
      ...plan.map(({ identifier }) => ({ identifier })), { identifier: 'other-feature' }
    ] as never);
    await syncStudyReminders(() => ({ enabled: true, completedDates: ['2026-09-08'] }));
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(plan[0].identifier);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it.each([false, true])('clears owned reminders when disabled or permission denied (%s)', async (enabled) => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as never);
    jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
      { identifier: `${REMINDER_PREFIX}old` }, { identifier: 'other-feature' }
    ] as never);
    await syncStudyReminders(() => ({ enabled, completedDates: [] }));
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('recovers after a native error and reads the latest queued preference', async () => {
    jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockRejectedValueOnce(new Error('native'));
    await expect(syncStudyReminders(() => ({ enabled: true, completedDates: [] }))).rejects.toThrow('native');
    let enabled = true;
    const task = syncStudyReminders(() => ({ enabled, completedDates: [] }));
    enabled = false;
    await task;
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
