export const REMINDER_PREFIX = 'daily-study-reminder:';

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Stay below iOS's pending-notification limit. Replenished whenever the app opens.
export function buildReminderPlan(completedDates: string[], now = new Date()) {
  const completed = new Set(completedDates);
  return Array.from({ length: 60 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 20);
    return { identifier: `${REMINDER_PREFIX}${date.getTime()}`, date };
  }).filter(({ date }) => date > now && !completed.has(dateKey(date)));
}
