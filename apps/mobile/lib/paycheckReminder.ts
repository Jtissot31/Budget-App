import { getSetting, setSetting } from '@/lib/db';

const reminderKey = (alertId: string) => `alert_paycheck_reminder_${alertId}`;
const collapsedKey = (alertId: string) => `alert_collapsed_${alertId}`;
const scheduleKey = (alertId: string) => `alert_paycheck_schedule_${alertId}`;
const entryDismissedKey = (alertId: string) => `alert_paycheck_entry_dismissed_${alertId}`;

export type PaycheckReminderSchedule = {
  paycheckDateKey: string;
  paymentName: string;
  accountName: string;
  accountId?: string;
  paycheckIsEstimated?: boolean;
};

export type PaycheckEntryPrompt = PaycheckReminderSchedule & { alertId: string };

function todayKey(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function buildPaycheckEntryMessage(prompt: PaycheckEntryPrompt): string {
  const payment = prompt.paymentName || 'ton prochain paiement';
  const account = prompt.accountName || 'ton compte';
  const estimated = prompt.paycheckIsEstimated !== false;
  if (estimated) {
    return `C'est le jour de ta paie estimée. Entre ton dépôt sur ${account} pour couvrir ${payment}.`;
  }
  return `C'est le jour de ta paie. Entre ton dépôt sur ${account} pour couvrir ${payment}.`;
}

export async function isPaycheckReminderEnabled(alertId: string): Promise<boolean> {
  return (await getSetting(reminderKey(alertId), '')) === '1';
}

export async function isAlertCollapsed(alertId: string): Promise<boolean> {
  return (await getSetting(collapsedKey(alertId), '')) === '1';
}

export async function loadAlertUiState(alertIds: string[]) {
  const reminders: Record<string, boolean> = {};
  const collapsed: Record<string, boolean> = {};
  await Promise.all(
    alertIds.map(async (id) => {
      reminders[id] = await isPaycheckReminderEnabled(id);
      collapsed[id] = await isAlertCollapsed(id);
    }),
  );
  return { reminders, collapsed };
}

async function savePaycheckReminderSchedule(alertId: string, schedule: PaycheckReminderSchedule) {
  await setSetting(scheduleKey(alertId), JSON.stringify(schedule));
}

async function clearPaycheckReminderSchedule(alertId: string) {
  await setSetting(scheduleKey(alertId), '');
  await setSetting(entryDismissedKey(alertId), '');
}

export async function enablePaycheckReminder(alertId: string, schedule?: PaycheckReminderSchedule) {
  await setSetting(reminderKey(alertId), '1');
  await setSetting(collapsedKey(alertId), '1');
  if (schedule) {
    await savePaycheckReminderSchedule(alertId, schedule);
    await setSetting(entryDismissedKey(alertId), '');
  }
}

export async function disablePaycheckReminder(alertId: string) {
  await setSetting(reminderKey(alertId), '0');
  await clearPaycheckReminderSchedule(alertId);
}

export async function setAlertCollapsed(alertId: string, collapsed: boolean) {
  await setSetting(collapsedKey(alertId), collapsed ? '1' : '0');
}

export async function dismissPaycheckEntryPromptForToday(alertId: string) {
  await setSetting(entryDismissedKey(alertId), todayKey());
}

export async function findDuePaycheckEntryPrompt(
  alertIds: string[],
  today: Date = new Date(),
): Promise<PaycheckEntryPrompt | null> {
  const todayK = todayKey(startOfDay(today));
  for (const alertId of alertIds) {
    if (!(await isPaycheckReminderEnabled(alertId))) continue;
    const raw = await getSetting(scheduleKey(alertId), '');
    if (!raw) continue;
    let schedule: PaycheckReminderSchedule;
    try {
      schedule = JSON.parse(raw) as PaycheckReminderSchedule;
    } catch {
      continue;
    }
    if (!schedule.paycheckDateKey || todayK < schedule.paycheckDateKey) continue;
    if ((await getSetting(entryDismissedKey(alertId), '')) === todayK) continue;
    return { alertId, ...schedule };
  }
  return null;
}
