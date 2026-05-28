import { isDatabaseEmpty } from './db';
import { seedDatabase } from './seed';

let initialized = false;

export async function ensureDbReady(): Promise<void> {
  if (initialized) return;
  if (await isDatabaseEmpty()) {
    await seedDatabase();
  }
  initialized = true;
}
