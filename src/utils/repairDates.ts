import { db } from '../db';
import { normalizeDate } from './date';

const REPAIR_FLAG_KEY = 'date-repair-v1-done';

export async function runDateRepair(): Promise<void> {
  const flag = await db.preferences.get(REPAIR_FLAG_KEY);
  if (flag?.value === true) return;

  let repairedCount = 0;

  // Repair transactions
  const transactions = await db.transactions.toArray();
  for (const tx of transactions) {
    const normalized = normalizeDate(tx.date);
    if (normalized && normalized !== tx.date) {
      await db.transactions.update(tx.id, { date: normalized });
      repairedCount++;
    }
  }

  // Repair accounts
  const accounts = await db.accounts.toArray();
  for (const acc of accounts) {
    const normalized = normalizeDate(acc.createdAt);
    if (normalized && normalized !== acc.createdAt) {
      await db.accounts.update(acc.id, { createdAt: normalized });
      repairedCount++;
    }
  }

  if (repairedCount > 0) {
    console.log(`[neto] Repaired ${repairedCount} malformed date(s). Clearing portfolio cache.`);
    await db.portfolioHistory.clear();
  }

  await db.preferences.put({ key: REPAIR_FLAG_KEY, value: true });
}
