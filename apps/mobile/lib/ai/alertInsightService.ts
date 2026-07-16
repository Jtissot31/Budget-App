/**
 * Alert detail insight — preventative tips via Gemini Flash + local memory context.
 */
import type { AlertCenterItem } from '@/lib/alerts';
import { isRecurringPaymentAlert } from '@/lib/alertPresentation';

import { appendAIMemory, formatMemoryForPrompt, loadAIMemory } from './aiMemory';
import { generateGeminiContent } from './geminiClient';

export type AlertInsightContext = Pick<
  AlertCenterItem,
  'kind' | 'title' | 'message' | 'montant' | 'recurring' | 'paymentName' | 'id'
> & {
  categoryLabel: string;
};

async function buildAlertInsightPrompt(ctx: AlertInsightContext): Promise<string> {
  const recurring = isRecurringPaymentAlert(ctx);
  const memory = formatMemoryForPrompt(await loadAIMemory());

  return [
    'Tu es Fyn, conseiller financier bienveillant dans une app québécoise.',
    'Rédige un conseil préventif court (1 à 2 phrases, maximum 40 mots) en français clair et rassurant.',
    'Le conseil doit aider à ÉVITER que ce problème se reproduise — pas comment le régler maintenant.',
    'Ton calme, simple, non culpabilisant. Pas de listes, pas de markdown, pas de titres.',
    memory,
    'Contexte de l’alerte :',
    JSON.stringify({
      titre: ctx.title,
      message: ctx.message,
      categorie: ctx.categoryLabel,
      type: ctx.kind,
      montant: ctx.montant ?? null,
      paiementRecurrent: recurring,
      marchand: ctx.paymentName ?? null,
    }),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Gemini Flash preventative insight — null when unavailable. */
export async function generateAlertProblemInsight(
  ctx: AlertInsightContext,
): Promise<string | null> {
  const prompt = await buildAlertInsightPrompt(ctx);
  const text = await generateGeminiContent({
    prompt,
    temperature: 0.35,
    maxOutputTokens: 120,
  });

  if (text) {
    void appendAIMemory({
      type: 'insight',
      summary: text.slice(0, 120),
      context: {
        alertKind: ctx.kind,
        merchant: ctx.paymentName ?? null,
      },
    });
  }

  return text;
}
