import { loadEncryptedJson, removeEncryptedItem, saveEncryptedJson } from '@/lib/ai/encryptedStorage';

const PENDING_PLAN_CHAT_CONFIRM_KEY = 'bt_pending_plan_chat_confirm_v1';

export async function setPendingPlanChatConfirmation(count: number): Promise<void> {
  await saveEncryptedJson(PENDING_PLAN_CHAT_CONFIRM_KEY, { count });
}

export async function consumePendingPlanChatConfirmation(): Promise<number | null> {
  const payload = await loadEncryptedJson<{ count: number }>(PENDING_PLAN_CHAT_CONFIRM_KEY);
  await removeEncryptedItem(PENDING_PLAN_CHAT_CONFIRM_KEY);
  if (!payload || typeof payload.count !== 'number' || payload.count <= 0) return null;
  return payload.count;
}
