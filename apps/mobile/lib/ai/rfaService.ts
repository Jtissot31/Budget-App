import { getGeminiApiKey } from './env';
import {
  buildHeuristicRFA,
  buildRFAInputFromAppData,
  buildSanitizedPayloadForAI,
  sanitizeForAI,
} from './sanitizeForAI';
import { loadEncryptedJson, removeEncryptedItem, saveEncryptedJson } from './encryptedStorage';
import type { FinancialSummaryAnonymous, RfaRegenerationTrigger } from './types';

const RFA_STORAGE_KEY = 'bt_ai_rfa_v1';
const RFA_LAST_GENERATED_KEY = 'bt_ai_rfa_last_generated_v1';

const REGENERATION_THROTTLE_MS = 24 * 60 * 60 * 1000;
const BALANCE_DELTA_THRESHOLD = 500;

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

let cachedRfa: FinancialSummaryAnonymous | null = null;

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
}

export async function clearRFA(): Promise<void> {
  cachedRfa = null;
  await removeEncryptedItem(RFA_STORAGE_KEY);
  await removeEncryptedItem(RFA_LAST_GENERATED_KEY);
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
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildGeminiPrompt(input) }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
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
