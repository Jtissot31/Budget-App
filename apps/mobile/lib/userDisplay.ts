import { getSetting } from '@/lib/db';

const KEY = 'user_display_name';

export async function getUserDisplayName(): Promise<string> {
  return getSetting(KEY, 'Jérémie');
}
