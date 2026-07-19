import { dataEvents } from '@/lib/events';
import { generateGeminiContent } from './geminiClient';
import {
  buildHeuristicRFA,
  buildRFAInputFromAppData,
  buildSanitizedPayloadForAI,
  sanitizeForAI,
} from './sanitizeForAI';
import { loadEncryptedJson, removeEncryptedItem, saveEncryptedJson } from './encryptedStorage';
import { invalidateChatSessionCache } from './chatSession';
import type { FinancialSummaryAnonymous, RfaRegenerationTrigger } from './types';

const RFA_STORAGE_KEY = 'bt_ai_rfa_v1';
const RFA_LAST_GENERATED_KEY = 'bt_ai_rfa_last_generated_v1';

const REGENERATION_THROTTLE_MS = 24 * 60 * 60 * 1000;
const BALANCE_DELTA_THRESHOLD = 500;

let cachedRfa: FinancialSummaryAnonymous | null = null;

/** Drop in-memory RFA + chat session when loans/accounts/budgets change. */
dataEvents.subscribe(() => {
  cachedRfa = null;
  invalidateChatSessionCache();
});

async function getLastGeneratedAt(): Promise<number | null> {
  const raw = await loadEncryptedJson<{ generatedAt: string }>(RFA_LAST_GENERATED_KEY);
  if (!raw?.generatedAt) return null;
  const ts = Date.parse(raw.generatedAt);
  return Number.isFinite(ts) ? ts : null;
}

export async function loadRFA(): Promise<FinancialSummaryAnonymous | null> {
  if (cachedRfa) return cachedRfa;
  cachedRfa = await loadEncryptedJson<FinancialSummaryAnonymous>(RFA_STORAGE_KEY);
  return cachedRfa;
}

export async function saveRFA(rfa: FinancialSummaryAnonymous): Promise<void> {
  cachedRfa = rfa;
  await saveEncryptedJson(RFA_STORAGE_KEY, rfa);
  await saveEncryptedJson(RFA_LAST_GENERATED_KEY, { generatedAt: rfa.generatedAt });
  invalidateChatSessionCache();
}

export async function clearRFA(): Promise<void> {
  cachedRfa = null;
  invalidateChatSessionCache();
  await removeEncryptedItem(RFA_STORAGE_KEY);
  await removeEncryptedItem(RFA_LAST_GENERATED_KEY);
}

/**
 * Rebuild RFA structured fields (dettes, comptes, profil, analyse) from live SQLite.
 * Fast heuristic path — used before chat / plan suggestions so rates & balances stay current.
 * Preserves Gemini-enriched plans/alerts from the previous snapshot when present.
 */
export async function refreshRfaSnapshotFromAppData(): Promise<FinancialSummaryAnonymous> {
  const input = await buildRFAInputFromAppData();
  const fresh = buildHeuristicRFA(input);
  const existing = cachedRfa ?? (await loadEncryptedJson<FinancialSummaryAnonymous>(RFA_STORAGE_KEY));

  const rfa: FinancialSummaryAnonymous = existing
    ? {
        ...fresh,
        plansFinanciersActifs: existing.plansFinanciersActifs?.length
          ? existing.plansFinanciersActifs
          : fresh.plansFinanciersActifs,
        alertesActives: existing.alertesActives?.length
          ? existing.alertesActives
          : fresh.alertesActives,
      }
    : fresh;

  await saveRFA(rfa);
  return rfa;
}

function buildGeminiPrompt(input: Awaited<ReturnType<typeof buildRFAInputFromAppData>>): string {
  return [
    'Tu es un analyste financier. Génère un Résumé Financier Anonyme (RFA) JSON strict.',
    'Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.',
    'Structure attendue : generatedAt (ISO), dataMode, langue, profil, comptes, dettes,',
    'abonnementsDetectes, objectifsActifs, plansFinanciersActifs, alertesActives, analyse (200-300 mots).',
    'Données anonymisées :',
    JSON.stringify(buildSanitizedPayloadForAI(input)),
  ].join('\n');
}

async function callGeminiForRFA(
  input: Awaited<ReturnType<typeof buildRFAInputFromAppData>>,
): Promise<FinancialSummaryAnonymous | null> {
  const text = await generateGeminiContent({
    prompt: buildGeminiPrompt(input),
    temperature: 0.2,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
  });

  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as FinancialSummaryAnonymous;
    if (!parsed.generatedAt) {
      parsed.generatedAt = new Date().toISOString();
    }
    return sanitizeForAI(parsed);
  } catch {
    return null;
  }
}

/** Regenerate RFA via Gemini Flash 2.5, with local heuristic fallback. */
export async function regenerateRFA(
  _trigger?: RfaRegenerationTrigger,
): Promise<FinancialSummaryAnonymous> {
  const input = await buildRFAInputFromAppData();
  const fromGemini = await callGeminiForRFA(input);
  const rfa = fromGemini ?? buildHeuristicRFA(input);
  await saveRFA(rfa);
  return rfa;
}

export async function shouldRegenerateRFA(
  trigger?: RfaRegenerationTrigger,
): Promise<boolean> {
  const existing = await loadRFA();
  if (!existing) return true;

  const lastGenerated = await getLastGeneratedAt();
  const now = Date.now();
  if (lastGenerated && now - lastGenerated < REGENERATION_THROTTLE_MS) {
    return false;
  }

  if (!trigger) return false;

  switch (trigger.reason) {
    case 'initial_setup':
    case 'new_plaid_account':
    case 'manual_balance_edit':
    case 'plan_change':
    case 'goal_change':
      return true;
    case 'balance_delta':
      return trigger.detail?.includes('500') ?? false;
    case 'scheduled':
      return true;
    default:
      return false;
  }
}

/** Called on app boot — ensures an RFA exists without blocking UI. */
export async function hydrateRFAOnBoot(): Promise<void> {
  try {
    const existing = await loadRFA();
    if (existing) {
      const shouldRefresh = await shouldRegenerateRFA({ reason: 'scheduled' });
      if (shouldRefresh) {
        await regenerateRFA({ reason: 'scheduled' });
      }
      return;
    }
    await regenerateRFA({ reason: 'initial_setup' });
  } catch {
    // Non-blocking — chat falls back to heuristic generation on demand.
  }
}

export function noteBalanceDeltaForRfa(previousBalance: number, nextBalance: number): boolean {
  return Math.abs(nextBalance - previousBalance) >= BALANCE_DELTA_THRESHOLD;
}
