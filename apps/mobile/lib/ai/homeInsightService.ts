/**
 * Dashboard home insight — optional Gemini refinement of alert message copy.
 */
import type { AlertCenterItem } from '@/lib/alerts';

import { appendAIMemory, formatMemoryForPrompt, loadAIMemory } from './aiMemory';
import { generateGeminiContent } from './geminiClient';
import { buildFreshFynContextDigest } from './fynFinancialContext';

export type HomeInsightContext = Pick<
  AlertCenterItem,
  'kind' | 'title' | 'message' | 'paymentName' | 'montant'
>;

async function buildHomeInsightPrompt(ctx: HomeInsightContext): Promise<string> {
  const [memoryEntries, financialContext] = await Promise.all([
    loadAIMemory(),
    buildFreshFynContextDigest(`${ctx.title} ${ctx.paymentName ?? ''}`).catch(() => ''),
  ]);
  const memory = formatMemoryForPrompt(memoryEntries, 5);

  return [
    'Tu es Fyn, conseiller financier bienveillant dans une app québécoise.',
    'Reformule ce message d’alerte en 1 phrase courte (max 25 mots), français calme et concret.',
    'Pas de markdown, pas de titre. Garde le sens — sois plus direct si possible.',
    memory,
    financialContext ? `Contexte financier frais : ${financialContext}` : '',
    JSON.stringify({
      titre: ctx.title,
      message: ctx.message,
      type: ctx.kind,
      marchand: ctx.paymentName ?? null,
      montant: ctx.montant ?? null,
    }),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Refined dashboard insight message — null keeps the static alert message. */
export async function generateHomeInsightMessage(
  ctx: HomeInsightContext,
): Promise<string | null> {
  const text = await generateGeminiContent({
    prompt: await buildHomeInsightPrompt(ctx),
    temperature: 0.35,
    maxOutputTokens: 80,
  });

  if (text) {
    void appendAIMemory({
      type: 'insight',
      summary: text.slice(0, 120),
      context: { surface: 'home', alertKind: ctx.kind, merchant: ctx.paymentName ?? null },
    });
  }

  return text;
}
