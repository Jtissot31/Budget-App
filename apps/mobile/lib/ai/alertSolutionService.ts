/**
 * AI-refined alert action suggestions — Gemini personalizes descriptions; static fallbacks preserved.
 */
import type { AlertCenterItem } from '@/lib/alerts';
import type { AlertSolution } from '@/lib/alertPresentation';

import { appendAIMemory, formatMemoryForPrompt, loadAIMemory } from './aiMemory';
import { generateGeminiContent } from './geminiClient';
import { buildFreshFynContextDigest } from './fynFinancialContext';

export type AlertSolutionContext = Pick<
  AlertCenterItem,
  'kind' | 'title' | 'message' | 'montant' | 'recurring' | 'paymentName' | 'id'
>;

async function buildSolutionPrompt(
  ctx: AlertSolutionContext,
  staticSolutions: AlertSolution[],
): Promise<string> {
  const [memoryEntries, financialContext] = await Promise.all([
    loadAIMemory(),
    buildFreshFynContextDigest(`${ctx.title} ${ctx.paymentName ?? ''}`).catch(() => ''),
  ]);
  const memory = formatMemoryForPrompt(memoryEntries);

  return [
    'Tu es Fyn, conseiller financier dans une app québécoise.',
    'Personnalise les descriptions des actions ci-dessous (1 phrase courte chacune, français calme).',
    'Garde les mêmes id, title, ctaLabel, href et params — modifie uniquement description.',
    'Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown.',
    memory,
    financialContext ? `Contexte financier frais : ${financialContext}` : '',
    'Contexte alerte :',
    JSON.stringify({
      type: ctx.kind,
      titre: ctx.title,
      message: ctx.message,
      marchand: ctx.paymentName ?? null,
      montant: ctx.montant ?? null,
    }),
    'Actions à personnaliser :',
    JSON.stringify(
      staticSolutions.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        ctaLabel: s.ctaLabel,
        href: s.href,
        params: s.params ?? null,
      })),
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

function mergeRefinedDescriptions(
  staticSolutions: AlertSolution[],
  refined: Array<{ id: string; description?: string }>,
): AlertSolution[] {
  const byId = new Map(refined.map((entry) => [entry.id, entry.description?.trim()]));
  return staticSolutions.map((solution) => {
    const nextDescription = byId.get(solution.id);
    if (!nextDescription) return solution;
    return { ...solution, description: nextDescription };
  });
}

/** Returns AI-refined solutions or the static list when Gemini is unavailable. */
export async function generateAlertSolutions(
  ctx: AlertSolutionContext,
  staticSolutions: AlertSolution[],
): Promise<AlertSolution[]> {
  const prompt = await buildSolutionPrompt(ctx, staticSolutions);
  const text = await generateGeminiContent({
    prompt,
    temperature: 0.3,
    maxOutputTokens: 600,
    responseMimeType: 'application/json',
  });

  if (!text) return staticSolutions;

  try {
    const parsed = JSON.parse(text) as Array<{ id: string; description?: string }>;
    if (!Array.isArray(parsed)) return staticSolutions;
    const merged = mergeRefinedDescriptions(staticSolutions, parsed);
    void appendAIMemory({
      type: 'alert_resolution',
      summary: `Actions personnalisées : ${ctx.title}`.slice(0, 120),
      context: { alertKind: ctx.kind, merchant: ctx.paymentName ?? null },
    });
    return merged;
  } catch {
    return staticSolutions;
  }
}
