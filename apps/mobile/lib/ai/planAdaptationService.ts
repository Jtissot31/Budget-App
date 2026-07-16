/**
 * Plan recommendation enrichment — Gemini adapts raison_recommandation with local memory.
 */
import type { PlanSuggere } from '@/lib/plans/Plan';

import { appendAIMemory, formatMemoryForPrompt, loadAIMemory } from './aiMemory';
import { generateGeminiContent } from './geminiClient';
import { sanitizePlanSuggestionReason } from '@/lib/plans/planSuggestionCopy';

export async function enrichPlanSuggestionReason(
  plan: PlanSuggere,
  financialSnapshot?: string,
): Promise<string> {
  const memory = formatMemoryForPrompt(await loadAIMemory(), 6);
  const fallback = plan.raison_recommandation;

  const prompt = [
    'Tu es Fyn, conseiller financier québécois.',
    'Adapte la raison de recommandation ci-dessous en 1–2 phrases courtes, concrètes, en français.',
    'Réponds UNIQUEMENT avec le texte final — pas de markdown, pas de listes, pas de guillemets, pas de préambule.',
    memory,
    financialSnapshot ? `Contexte financier : ${financialSnapshot}` : '',
    JSON.stringify({
      plan: plan.titre,
      sousType: plan.subtype,
      raisonActuelle: fallback,
      signal: plan.signal_declencheur,
    }),
  ]
    .filter(Boolean)
    .join('\n');

  const refined = await generateGeminiContent({
    prompt,
    temperature: 0.35,
    maxOutputTokens: 120,
  });

  if (!refined) return fallback;

  const cleaned = sanitizePlanSuggestionReason(refined, fallback);
  if (cleaned === fallback) return fallback;

  void appendAIMemory({
    type: 'plan_adaptation',
    summary: `${plan.titre}: ${cleaned.slice(0, 80)}`,
    context: { subtype: plan.subtype },
  });

  return cleaned;
}

const PLAN_SUGGESTION_ENRICHMENT_TIMEOUT_MS = 6_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

/** Enriches each suggestion when Gemini is available; returns originals on failure or timeout. */
export async function enrichPlanSuggestions(
  plans: PlanSuggere[],
  financialSnapshot?: string,
): Promise<PlanSuggere[]> {
  if (plans.length === 0) return plans;

  const enriched = await Promise.all(
    plans.map(async (plan) => {
      try {
        const raison_recommandation = await withTimeout(
          enrichPlanSuggestionReason(plan, financialSnapshot),
          PLAN_SUGGESTION_ENRICHMENT_TIMEOUT_MS,
          plan.raison_recommandation,
        );
        return { ...plan, raison_recommandation };
      } catch (error) {
        if (__DEV__) console.warn('[enrichPlanSuggestions] failed for', plan.subtype, error);
        return plan;
      }
    }),
  );

  return enriched;
}

/** Adapts static template copy when opening a plan model without a prior suggestion. */
export async function enrichPlanTemplateWhy(
  subtype: string,
  titre: string,
  staticDescription: string,
): Promise<string> {
  const memory = formatMemoryForPrompt(await loadAIMemory(), 5);

  const prompt = [
    'Tu es Fyn, conseiller financier québécois.',
    'Adapte la description ci-dessous en 1–2 phrases courtes, concrètes, en français.',
    'Réponds UNIQUEMENT avec le texte final — pas de markdown, pas de listes, pas de guillemets, pas de préambule.',
    memory,
    JSON.stringify({ plan: titre, sousType: subtype, descriptionActuelle: staticDescription }),
  ]
    .filter(Boolean)
    .join('\n');

  const refined = await generateGeminiContent({
    prompt,
    temperature: 0.35,
    maxOutputTokens: 120,
  });

  if (!refined) return staticDescription;

  const cleaned = sanitizePlanSuggestionReason(refined, staticDescription);
  if (cleaned === staticDescription) return staticDescription;

  void appendAIMemory({
    type: 'plan_adaptation',
    summary: `${titre}: ${cleaned.slice(0, 80)}`,
    context: { subtype },
  });

  return cleaned;
}
