import { executeChatAction, isExecutableChatAction } from './actionExecutor';

import {
  buildActionResultAlertCard,
  isTextConfirmation,
} from './actionConfirmation';

import {
  findActionJsonBlocks,
  messageBlocksToPlainText,
  parseMessageBlocks,
  stripCodeFromAssistantText,
  suppressDuplicateActionProse,
} from './messageBlocks';

import {
  buildPlanSuggestionsIntro,
} from '@/lib/plans/planRecommendationEngine';

import {
  buildPlanGoalChoiceIntro,
  buildPlanGoalChoiceState,
  buildPlanGoalConfirmedIntro,
  buildPlanSuggestionsForGoal,
  detectPlanGoal,
  isPlanGoalFollowUpMessage,
  isVaguePlanRequest,
  parsePlanGoalFromText,
  type ChatPlanGoalChoice,
  type PlanGoal,
} from '@/lib/plans/planGoalClarification';

import type { ActivityPhase } from './activityPhases';

import { loadEncryptedJson, removeEncryptedItem, saveEncryptedJson } from './encryptedStorage';

import { getAnthropicApiKey, getGeminiApiKey, isFynChatApiKeyConfigured } from './env';

import { GeminiApiError, generateGeminiChat } from './geminiClient';

import { loadRFA, regenerateRFA, saveRFA } from './rfaService';

import {
  buildHeuristicRFA,
  buildRFAInputFromAppData,
  resolveDataMode,
  sanitizeForAI,
} from './sanitizeForAI';

import {
  getChatSessionContext,
  invalidateChatSessionCache,
  isChatSessionContextCached,
  setChatSessionContext,
} from './chatSession';

import { readChatImageAttachment } from './imageAttachment';

import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

import type {

  ChatAction,

  ChatActionType,

  ChatImageAttachment,

  ChatMessage,

  ChatPlanSuggestions,

  ChatQuotaState,

  FinancialSummaryAnonymous,

} from './types';



const CHAT_HISTORY_KEY = 'bt_ai_chat_history_v1';

const CHAT_QUOTA_KEY = 'bt_ai_chat_quota_v1';

const MAX_HISTORY_MESSAGES = 50;

/** Recent turns sent to the model — full history stays persisted locally. */
const MAX_API_HISTORY_MESSAGES = 12;

// Prompt revision 3 — short FR replies + plain text; clear warm cache on module reload.
invalidateChatSessionCache();



const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';



const ALL_ACTION_TYPES: ChatActionType[] = [

  'creer_objectif',

  'modifier_objectif',

  'creer_categorie_budget',

  'modifier_categorie_budget',

  'creer_compte',

  'modifier_compte',

  'creer_marchand',

  'modifier_marchand',

  'creer_patrimoine',

  'modifier_patrimoine',

  'creer_pret',

  'modifier_pret',

  'creer_transaction',

  'modifier_transaction',

  'creer_paiement_recurrent',

  'modifier_paiement_recurrent',

  'creer_alerte',

  'modifier_plan',

  'pause_plan',

  'modifier_priorite_dette',

  'adapter_dashboard',

];



function createMessageId(role: ChatMessage['role']): string {

  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}



function buildWidgetCapabilitiesSection(): string {
  const examples = [
    '{"type":"progress_card","label":"Fonds d\'urgence","value_label":"12 600,00 $","percent":70,"percent_label":"70 % de l\'objectif","status_line":"Paiement hypothèque sécurisé"}',
    '{"type":"debt_table","label":"Dettes actives","rows":[{"name":"Visa Desjardins","balance":"4 200 $","rate":"19,9 %","payment":"125 $"},{"name":"Prêt auto","balance":"8 500 $","rate":"6,5 %","payment":"320 $"}],"total":{"label":"Total","balance":"12 700 $","payment":"445 $"}}',
    '{"type":"comparison_card","label":"Scénarios de remboursement","items":[{"label":"Avalanche (intérêts)","value":"−1 240 $","highlight":true},{"label":"Boule de neige","value":"−980 $"}],"footer":"Économie d\'intérêts sur 12 mois"}',
    '{"type":"line_chart","label":"Valeur nette (6 mois)","data":[14200,14550,14100,14800,15120,15480],"value_label":"15 480 $","caption":"Tendance haussière malgré le creux de mars"}',
    '{"type":"bar_chart","label":"Dépenses par catégorie","items":[{"label":"Logement","value":1450,"value_label":"1 450 $"},{"label":"Épicerie","value":620,"value_label":"620 $"},{"label":"Transport","value":280,"value_label":"280 $"}],"caption":"Mois en cours"}',
    '{"type":"allocation_chart","label":"Répartition du budget","segments":[{"label":"Essentiels","value":55,"percent":55},{"label":"Loisirs","value":20,"percent":20},{"label":"Épargne","value":25,"percent":25}],"caption":"Part du revenu net mensuel"}',
    '{"type":"alert_card","severity":"warning","title":"Budget restaurants dépassé","message":"Tu as utilisé 112 % de ton enveloppe ce mois-ci.","action":{"label":"Voir le budget"}}',
  ];

  return [
    'WIDGETS STRUCTURÉS (UI génératif) :',
    'Pour montants, pourcentages, tableaux de dettes, comparaisons, projections et graphiques, produis un bloc JSON widget AU LIEU de tableaux markdown.',
    'Types disponibles : progress_card, debt_table, comparison_card, alert_card, line_chart, bar_chart, allocation_chart.',
    'Place chaque widget dans son propre bloc JSON (objet standalone ou ```json```) — JAMAIS dans la prose, JAMAIS tronqué, JAMAIS visible pour l\'utilisateur.',
    'Le texte conversationnel reste en prose courte ; les widgets sont des blocs JSON séparés parsés par l\'app.',
    'Les widgets peuvent coexister avec le bloc action JSON (champ "action") — ne pas mélanger les formats.',
    '',
    'Quand utiliser un graphique :',
    '- line_chart : évolution dans le temps (valeur nette, épargne, dette, dépenses sur plusieurs mois). data = nombres bruts (min 2 points).',
    '- bar_chart : comparer des catégories ou montants discrets (dépenses par catégorie, revenus vs dépenses). items[].value = nombre brut.',
    '- allocation_chart : répartition en parts (budget, actifs, dettes par type). segments[].value = part numérique (souvent % ou montant).',
    '- comparison_card : 2–4 scénarios textuels sans série temporelle ni barres.',
    '- progress_card : un seul objectif avec barre de progression (%).',
    '',
    'Schémas :',
    '- progress_card : label, value_label, percent (0-100), percent_label, status_line?, actions?[{label}]',
    '- debt_table : label?, columns?, rows[{name,balance,rate?,payment?}], total{label,balance,rate?,payment?}',
    '- comparison_card : label, items[{label,value,highlight?}], primary_index?, footer?',
    '- line_chart : label, data[number] (min 2), value_label?, caption?, positive?',
    '- bar_chart : label, items[{label,value,value_label?}], caption?',
    '- allocation_chart : label, segments[{label,value,percent?}], caption?',
    '- alert_card : severity (info|warning|danger|success), title, message, action?{label}',
    '',
    'Après exécution réussie d\'une action (confirmation bouton ou texte « oui » / « ok » / « confirme »), réponds UNIQUEMENT avec un bloc alert_card JSON (severity: success) — jamais de prose seule pour le résultat final.',
    'Exemple succès : {"type":"alert_card","severity":"success","title":"C\'est fait","message":"La catégorie Restaurants est maintenant dans ton budget à 400 $/mois."}',
    '',
    'Exemples :',
    ...examples.map((example) => `- ${example}`),
  ].join('\n');
}

function buildResponseStyleSection(): string {
  return [
    'STYLE DE RÉPONSE (prioritaire — respecte STRICTEMENT) :',
    '- Langue : FRANÇAIS par défaut. Anglais UNIQUEMENT si le message de l\'utilisateur est en anglais.',
    '- LONGUEUR MAX : 4 à 6 phrases courtes, OU au plus 3 puces. Jamais un mur de texte, jamais une analyse multiparagraphe.',
    '- Structure : 1ère phrase = la réponse / recommandation directe. Puis détail minimal si besoin.',
    '- TEXTE BRUT UNIQUEMENT. Interdit absolument : markdown (###, ##, #, **, __, *, `, ```), titres, gras, italique, listes numérotées longues.',
    '- INTERDIT ABSOLU : afficher du JSON, du code, ou des blocs `{ "type": ... }` dans le texte visible — même partiellement.',
    '- Les widgets et actions passent UNIQUEMENT dans des blocs JSON séparés parsés par l\'app (jamais mélangés à la prose).',
    '- Pas de préambule (« Based on your profile… », « D\'après ton profil… »), pas de récapitulatif complet de la situation.',
    '- Pas de plan en 3+ étapes sauf si l\'utilisateur demande explicitement un plan détaillé / étape par étape.',
    '- Ton Fyn : chaleureux, actionnable, concis — jamais sec ni condescendant.',
    '- Chiffres, tableaux et graphiques → widgets JSON séparés ; le texte visible reste minimal.',
  ].join('\n');
}

function buildPlanFinancierGuidanceSection(): string {
  return [
    'DEMANDES « PLAN FINANCIER » / « GENERATE A PLAN » :',
    '- Réponse = 1 phrase courte d\'intro + widgets (debt_table, progress_card, comparison_card) si pertinent + bloc action JSON si modification.',
    '- Ne jamais rédiger un plan multiparagraphe dans le texte — l\'app affiche des cartes de plan et widgets structurés.',
    '- Exemple bon : « Voici un plan priorisé pour tes dettes. » + debt_table JSON + éventuellement action modifier_priorite_dette.',
    '- Exemple mauvais : 3 paragraphes d\'analyse + `{ "type": "debt_table", ...` visible dans le texte.',
  ].join('\n');
}

function buildActionCapabilitiesSection(): string {

  const examples = [

    '{"action":"creer_objectif","params":{"nom":"Vacances","montant_cible":5000,"montant_actuel":0,"contribution_hebdo":50},"confirmation":"Créer l\'objectif Vacances (5 000 $)?"}',

    '{"action":"modifier_objectif","params":{"nom":"Vacances","montant_cible":6000},"confirmation":"Modifier l\'objectif Vacances à 6 000 $?"}',

    '{"action":"creer_categorie_budget","params":{"nom":"Restaurants","limite_mensuelle":400},"confirmation":"Créer la catégorie Restaurants (400 $/mois)?"}',

    '{"action":"modifier_categorie_budget","params":{"nom":"Restaurants","limite_mensuelle":350},"confirmation":"Réduire le budget Restaurants à 350 $?"}',

    '{"action":"creer_compte","params":{"nom":"Tangerine chèque","type":"cheque","solde":1200},"confirmation":"Créer le compte Tangerine chèque?"}',

    '{"action":"modifier_compte","params":{"nom":"Tangerine chèque","solde":1500},"confirmation":"Mettre à jour le solde du compte Tangerine chèque?"}',

    '{"action":"creer_marchand","params":{"nom_original":"AMZN MKTP","nom_affichage":"Amazon"},"confirmation":"Renommer AMZN MKTP en Amazon?"}',

    '{"action":"creer_patrimoine","params":{"nom":"Or 1 oz","type":"precious_material","valeur_actuelle":3200},"confirmation":"Ajouter l\'actif Or 1 oz?"}',

    '{"action":"creer_pret","params":{"nom":"Prêt auto","principal":15000,"taux_interet":6.5,"paiement_mensuel":320},"confirmation":"Créer le prêt auto?"}',

    '{"action":"creer_transaction","params":{"libelle":"IGA","montant":87.42,"type":"depense","date":"2026-06-18","categorie_nom":"Épicerie"},"confirmation":"Enregistrer la dépense IGA (87,42 $)?"}',

    '{"action":"modifier_transaction","params":{"nom":"IGA","montant":92.10},"confirmation":"Corriger la transaction IGA à 92,10 $?"}',

    '{"action":"creer_paiement_recurrent","params":{"nom":"Netflix","montant":18.99,"frequence":"monthly","compte_nom":"Visa"},"confirmation":"Ajouter l\'abonnement Netflix?"}',

  ];



  return [

    'CAPACITÉS D\'ACTION :',

    'Tu peux déclencher UNE action par demande explicite de création/modification.',

    'Actions disponibles :',

    ...ALL_ACTION_TYPES.map((action) => `- ${action}`),

    '',

    'Format (bloc JSON séparé, invisible pour l\'utilisateur) :',

    '{"action": "nom_action", "params": {...}, "confirmation": "Message en français à afficher avant exécution"}',

    '',

    'Règles :',

    '- Ne jamais inclure de JSON, code ou blocs techniques dans le texte visible.',

    '- Les actions passent uniquement via le bloc JSON interne parsé par l\'app (sans markdown, sans ```).',

    '- Toujours inclure confirmation en français, claire et courte.',

    '- Quand tu émets un bloc action JSON : le texte visible = UNE phrase courte max (contexte ou recommandation), sans répéter la question de confirmation — la carte d\'action affiche déjà le CTA.',

    '- Exemple bon : prose « Bonne idée pour sécuriser tes dépenses. » + action JSON confirmation « Créer l\'objectif Fonds d\'urgence (10 000 $)? »',

    '- Exemple mauvais : prose « Veux-tu que je crée l\'objectif Fonds d\'urgence de 10 000 $? » + la même question dans confirmation.',

    '- Pour modifier_* : inclure id OU nom/libellé/nom_original pour identifier l\'entité.',

    '- Montants en nombres (pas de symbole $ dans le JSON).',

    '- Dates ISO (YYYY-MM-DD) quand pertinent.',

    '- Facture / photo reçue : extraire marchand, date, montant, articles → creer_transaction ou modifier_transaction.',

    '- Ne produis qu\'UN seul bloc action JSON par réponse actionnable.',

    '',

    'Exemples params :',

    ...examples.map((example) => `- ${example}`),

  ].join('\n');

}



const STATIC_FYN_SYSTEM_PREFIX = [

  'Tu es Fyn, un conseiller financier personnel intégré dans une app de finances personnelles canadienne.',

  'Tu as accès au profil financier complet et anonymisé de l\'utilisateur ci-dessous.',

  '',

  'RÈGLES ABSOLUES :',

  '- Ne jamais demander le nom, email ou informations personnelles de l\'utilisateur',

  '- Adapter ton registre au profil détecté (simple pour débutant, technique pour utilisateur avancé)',

  '- Être direct, honnête, jamais condescendant',

  '',

  buildResponseStyleSection(),

  '',

  buildPlanFinancierGuidanceSection(),

  '',

  buildActionCapabilitiesSection(),

  '',

  buildWidgetCapabilitiesSection(),

].join('\n');



function buildSystemPrompt(rfa: FinancialSummaryAnonymous, dataMode: 'plaid' | 'manual'): string {

  const manualRule =

    dataMode === 'manual'

      ? '- Les données sont en mode manuel : nuance systématiquement avec « basé sur ce que tu as entré ».'

      : '- Les données sont synchronisées : tu peux être affirmatif et proactive.';



  return [

    STATIC_FYN_SYSTEM_PREFIX,

    manualRule,

    '- Ne jamais promettre de rendements ou garantir des résultats',

    '- Si une question dépasse tes capacités (légal, fiscal complexe), recommander un professionnel',

    '- Ne jamais inclure de JSON, code ou blocs techniques dans le texte visible. Les actions passent uniquement via le bloc JSON interne parsé par l\'app.',

    '',

    'PROFIL FINANCIER ANONYME DE L\'UTILISATEUR :',

    JSON.stringify(sanitizeForAI(rfa)),

  ].join('\n');

}



export function parseActionsFromResponse(text: string): {

  cleanText: string;

  actions: ChatAction[];

  blocks: import('@/types/aiWidgets').MessageBlock[];

} {

  const actions: ChatAction[] = [];

  const seen = new Set<string>();

  const blocks = parseMessageBlocks(text);



  for (const match of findActionJsonBlocks(text)) {

    if (seen.has(match)) continue;

    seen.add(match);



    try {

      const parsed = JSON.parse(match) as ChatAction;

      if (parsed.action && parsed.confirmation && isExecutableChatAction(parsed.action)) {

        actions.push({

          action: parsed.action,

          params: parsed.params ?? {},

          confirmation: parsed.confirmation,

        });

      }

    } catch {

      // Ignore malformed action blocks.

    }

  }



  const dedupedBlocks = actions.length > 0 ? suppressDuplicateActionProse(blocks, actions) : blocks;
  const plainFromBlocks = messageBlocksToPlainText(dedupedBlocks);

  return {
    cleanText: plainFromBlocks || (actions.length > 0 ? '' : stripCodeFromAssistantText(text)),
    actions,
    blocks: dedupedBlocks,
  };

}



function findPendingActionInHistory(history: ChatMessage[]): ChatAction | null {

  for (let index = history.length - 1; index >= 0; index -= 1) {

    const message = history[index];

    if (message.role === 'assistant' && message.actions?.length) {

      return message.actions[message.actions.length - 1] ?? null;

    }

    if (message.role === 'user') break;

  }

  return null;

}



async function executeTextConfirmation(

  trimmed: string,

  history: ChatMessage[],

  pendingAction: ChatAction,

): Promise<SendChatMessageResult> {

  const userMessage: ChatMessage = {

    id: createMessageId('user'),

    role: 'user',

    content: trimmed,

    createdAt: new Date().toISOString(),

  };



  const result = await executeChatAction(pendingAction);

  const alertCard = buildActionResultAlertCard(result, pendingAction);

  const assistantMessage: ChatMessage = {

    id: createMessageId('assistant'),

    role: 'assistant',

    content: alertCard.message,

    blocks: [alertCard],

    createdAt: new Date().toISOString(),

  };



  const nextHistory = [...history, userMessage, assistantMessage];

  await saveChatHistory(nextHistory);

  const quota = await incrementQuota(trimmed, assistantMessage.content);



  return {

    userMessage,

    assistantMessage,

    quota,

    offlineMode: false,

  };

}



export async function loadChatHistory(): Promise<ChatMessage[]> {

  return (await loadEncryptedJson<ChatMessage[]>(CHAT_HISTORY_KEY)) ?? [];

}



export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {

  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);

  await saveEncryptedJson(CHAT_HISTORY_KEY, trimmed);

}



export async function clearChatHistory(): Promise<void> {

  await removeEncryptedItem(CHAT_HISTORY_KEY);

  await removeEncryptedItem(CHAT_QUOTA_KEY);

  invalidateChatSessionCache();

}



async function resolveRfaForChat(): Promise<FinancialSummaryAnonymous> {

  const existing = await loadRFA();

  if (existing) return existing;



  const input = await buildRFAInputFromAppData();

  const heuristic = buildHeuristicRFA(input);

  await saveRFA(heuristic);



  void regenerateRFA({ reason: 'initial_setup' }).then(() => {

    invalidateChatSessionCache();

  });



  return heuristic;

}



async function getChatContext(): Promise<{

  systemPrompt: string;

  rfa: FinancialSummaryAnonymous;

  dataMode: 'plaid' | 'manual';

}> {

  const cached = getChatSessionContext();

  if (cached) return cached;



  const [rfa, dataMode] = await Promise.all([resolveRfaForChat(), resolveDataMode()]);

  const context = {

    systemPrompt: buildSystemPrompt(rfa, dataMode),

    rfa,

    dataMode,

  };

  setChatSessionContext(context);

  return context;

}



/** Pre-warm RFA + system prompt so the first send skips cold-start DB work. */

export async function warmChatContext(): Promise<void> {

  await getChatContext();

}



export { invalidateChatSessionCache };



function trimHistoryForApi(history: ChatMessage[]): ChatMessage[] {

  return history

    .filter((message) => message.role === 'user' || message.role === 'assistant')

    .slice(-MAX_API_HISTORY_MESSAGES);

}



export async function getChatQuotaState(): Promise<ChatQuotaState> {

  const stored = await loadEncryptedJson<ChatQuotaState>(CHAT_QUOTA_KEY);

  const now = new Date();

  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;



  if (!stored || !('monthKey' in (stored as object))) {

    return {

      messagesThisMonth: 0,

      monthlyLimit: 0,

      tokensUsedEstimate: 0,

      warningThresholdReached: false,

    };

  }



  const withMonth = stored as ChatQuotaState & { monthKey?: string };

  if (withMonth.monthKey !== monthKey) {

    return {

      messagesThisMonth: 0,

      monthlyLimit: 0,

      tokensUsedEstimate: 0,

      warningThresholdReached: false,

    };

  }



  return {

    messagesThisMonth: withMonth.messagesThisMonth,

    monthlyLimit: 0,

    tokensUsedEstimate: withMonth.tokensUsedEstimate,

    warningThresholdReached: false,

  };

}



async function incrementQuota(userText: string, assistantText: string): Promise<ChatQuotaState> {

  const now = new Date();

  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

  const current = await getChatQuotaState();

  const next: ChatQuotaState & { monthKey: string } = {

    messagesThisMonth: current.messagesThisMonth + 1,

    monthlyLimit: 0,

    tokensUsedEstimate: current.tokensUsedEstimate + Math.ceil((userText.length + assistantText.length) / 4),

    warningThresholdReached: false,

    monthKey,

  };

  await saveEncryptedJson(CHAT_QUOTA_KEY, next);

  return next;

}



function buildGeminiFailureReply(error: unknown): string {
  const detail =
    error instanceof GeminiApiError
      ? error.userMessage
      : error instanceof Error
        ? error.message
        : null;

  return detail
    ? `Je n'ai pas pu joindre Gemini (${detail}). Réessaie dans un instant.`
    : "Je n'ai pas pu joindre Gemini pour le moment. Réessaie dans un instant.";
}

/** Local RFA-based reply when no API key is configured (offline demo mode). */
function buildLocalFallbackReply(

  userText: string,

  rfa: FinancialSummaryAnonymous,

  dataMode: 'plaid' | 'manual',

): string {

  const prefix =

    dataMode === 'manual'

      ? 'Basé sur ce que tu as entré, '

      : '';



  const normalized = userText.toLowerCase();



  if (normalized.includes('dette') || normalized.includes('rembours')) {

    const topDebt = rfa.dettes[0];

    const widget = topDebt
      ? {
          type: 'debt_table' as const,
          label: 'Dettes prioritaires',
          rows: rfa.dettes.slice(0, 3).map((debt) => ({
            name: debt.institution,
            balance: `${debt.solde.toFixed(0)} $`,
            rate: `${debt.tauxInteret.toFixed(1)} %`,
            payment: `${debt.paiementMinimum.toFixed(0)} $`,
          })),
          total: {
            label: 'Total',
            balance: `${rfa.dettes.reduce((sum, debt) => sum + debt.solde, 0).toFixed(0)} $`,
            payment: `${rfa.dettes.reduce((sum, debt) => sum + debt.paiementMinimum, 0).toFixed(0)} $`,
          },
        }
      : null;

    if (topDebt) {

      return `${prefix}ta priorité #1 semble être ${topDebt.institution} (${topDebt.solde.toFixed(0)} $ à ${topDebt.tauxInteret.toFixed(2)} %). On peut bâtir un plan avalanche pour réduire les intérêts.\n\n${JSON.stringify(widget)}`;

    }

    return `${prefix}je ne vois pas de dettes enregistrées. Veux-tu en ajouter une pour qu'on priorise le remboursement ?`;

  }



  if (normalized.includes('budget')) {

    return `${prefix}tes dépenses mensuelles moyennes sont d'environ ${rfa.profil.depensesMensuellesMoyennes.toFixed(0)} $ pour un revenu net de ${rfa.profil.revenuMensuelNet.toFixed(0)} $.`;

  }



  if (normalized.includes('résumé') || normalized.includes('resume') || normalized.includes('situation')) {

    return rfa.analyse;

  }



  return `${prefix}${rfa.analyse} Pose-moi une question sur ton budget, tes dettes ou tes objectifs.`;

}

function isDebtFocusedPlanRequest(userText: string): boolean {
  const normalized = userText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return /\b(dette|dettes|rembours|rembourser|desendett|snowball|avalanche)\b/.test(normalized);
}

function isFinancialPlanRequest(userText: string): boolean {
  const normalized = userText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/\b(plan\s*financier|financial\s*plan|money\s*plan)\b/.test(normalized)) {
    return true;
  }

  return (
    /\b(generer|generat|create|creer|propose|suggest|build|make|elaborer|bâtir|batir)\b.*\bplan\b/.test(
      normalized,
    ) || /\bplan\b.*\b(financier|financial|budget|dette|epargne|épargne)\b/.test(normalized)
  );
}

function buildDebtTableWidget(rfa: FinancialSummaryAnonymous): import('@/types/aiWidgets').AIWidgetData | null {
  if (!rfa.dettes.length) return null;

  return {
    type: 'debt_table',
    label: 'Dettes actives',
    rows: rfa.dettes.slice(0, 4).map((debt) => ({
      name: debt.institution,
      balance: formatDisplayMoneyAbsolute(debt.solde),
      rate: `${debt.tauxInteret.toFixed(1)} %`,
      payment: formatDisplayMoneyAbsolute(debt.paiementMinimum),
    })),
    total: {
      label: 'Total',
      balance: formatDisplayMoneyAbsolute(rfa.dettes.reduce((sum, debt) => sum + debt.solde, 0)),
      payment: formatDisplayMoneyAbsolute(
        rfa.dettes.reduce((sum, debt) => sum + debt.paiementMinimum, 0),
      ),
    },
  };
}

async function buildPlanFinancierChatReply(
  rfa: FinancialSummaryAnonymous,
  userText: string,
  goalOverride?: PlanGoal,
): Promise<{
  content: string;
  blocks: import('@/types/aiWidgets').MessageBlock[];
  planSuggestions?: ChatPlanSuggestions;
  planGoalChoice?: ChatPlanGoalChoice;
}> {
  const explicitGoal = goalOverride ?? detectPlanGoal(userText);
  const vagueRequest = isVaguePlanRequest(userText) && !goalOverride;

  if (vagueRequest && !explicitGoal) {
    const goalChoice = await buildPlanGoalChoiceState(rfa);
    const intro = buildPlanGoalChoiceIntro({
      suggested: goalChoice.suggested,
      reason: goalChoice.reason,
    });

    return {
      content: intro,
      blocks: [{ type: 'text', content: intro }],
      planGoalChoice: goalChoice,
    };
  }

  const goal = explicitGoal ?? 'debt_repayment';
  const summary = buildPlanGoalConfirmedIntro(goal);
  const suggestions = await buildPlanSuggestionsForGoal(rfa, goal);
  const intro =
    suggestions.length > 0
      ? summary
      : buildPlanSuggestionsIntro(0);

  const blocks: import('@/types/aiWidgets').MessageBlock[] = [{ type: 'text', content: intro }];

  if (goal === 'debt_repayment') {
    const debtWidget = buildDebtTableWidget(rfa);
    if (debtWidget) {
      blocks.push(debtWidget);
    }
  }

  return {
    content: intro,
    blocks,
    planSuggestions: {
      suggestions,
      intro,
      frozen: false,
      confirmedIds: [],
    },
  };
}

function findPendingPlanGoalChoice(history: ChatMessage[]): ChatMessage | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role === 'assistant' && message.planGoalChoice && !message.planGoalChoice.frozen) {
      return message;
    }
    if (message.role === 'user') break;
  }
  return null;
}

async function executePlanGoalFollowUp(
  trimmed: string,
  history: ChatMessage[],
  pendingMessage: ChatMessage,
  rfa: FinancialSummaryAnonymous,
  completedPhases: ActivityPhase[],
): Promise<SendChatMessageResult> {
  const pendingChoice = pendingMessage.planGoalChoice!;
  const goal = parsePlanGoalFromText(trimmed, pendingChoice.suggested, pendingChoice.options);

  if (!goal) {
    throw new Error('Plan goal not recognized');
  }

  const userMessage: ChatMessage = {
    id: createMessageId('user'),
    role: 'user',
    content: trimmed,
    createdAt: new Date().toISOString(),
  };

  const planReply = await buildPlanFinancierChatReply(rfa, trimmed, goal);

  const assistantMessage: ChatMessage = {
    id: createMessageId('assistant'),
    role: 'assistant',
    content: planReply.content,
    blocks: planReply.blocks,
    planSuggestions: planReply.planSuggestions,
    createdAt: new Date().toISOString(),
    activityPhases: completedPhases.length > 0 ? completedPhases : undefined,
  };

  const updatedHistory = history.map((message) =>
    message.id === pendingMessage.id
      ? {
          ...message,
          planGoalChoice: {
            ...pendingChoice,
            frozen: true,
            confirmedGoal: goal,
          },
        }
      : message,
  );

  const nextHistory = [...updatedHistory, userMessage, assistantMessage];
  await saveChatHistory(nextHistory);
  const quota = await incrementQuota(trimmed, assistantMessage.content);

  return {
    userMessage,
    assistantMessage,
    quota,
    offlineMode: false,
  };
}



type AnthropicContentBlock =

  | { type: 'text'; text: string }

  | {

      type: 'image';

      source: { type: 'base64'; media_type: string; data: string };

    };



type AnthropicMessage = {

  role: 'user' | 'assistant';

  content: string | AnthropicContentBlock[];

};



async function callGemini(

  systemPrompt: string,

  history: ChatMessage[],

  userText: string,

  image?: ChatImageAttachment,

  onToken?: (accumulated: string, delta: string) => void,

  signal?: AbortSignal,

): Promise<string> {

  const chatHistory = trimHistoryForApi(history).map((message) => ({

    role: message.role as 'user' | 'assistant',

    content: message.content,

  }));



  return generateGeminiChat({

    systemInstruction: systemPrompt,

    history: chatHistory,

    userText,

    image: image ? { base64: image.base64, mediaType: image.mediaType } : undefined,

    maxOutputTokens: 768,

    onToken,

    signal,

  });

}



async function callClaude(

  systemPrompt: string,

  history: ChatMessage[],

  userText: string,

  image?: ChatImageAttachment,

  signal?: AbortSignal,

): Promise<string | null> {

  const apiKey = getAnthropicApiKey();

  if (!apiKey) return null;



  const messages: AnthropicMessage[] = [

    ...trimHistoryForApi(history).map((message) => ({

      role: message.role,

      content: message.content,

    })),

  ];



  const userContent: AnthropicContentBlock[] = [];

  if (image) {

    userContent.push({

      type: 'image',

      source: {

        type: 'base64',

        media_type: image.mediaType,

        data: image.base64,

      },

    });

  }

  userContent.push({ type: 'text', text: userText });

  messages.push({ role: 'user', content: userContent });



  const response = await fetch(ANTHROPIC_ENDPOINT, {

    method: 'POST',

    headers: {

      'Content-Type': 'application/json',

      'x-api-key': apiKey,

      'anthropic-version': '2023-06-01',

    },

    body: JSON.stringify({

      model: ANTHROPIC_MODEL,

      max_tokens: 384,

      system: systemPrompt,

      messages,

    }),

    signal,

  });



  if (!response.ok) return null;



  const payload = (await response.json()) as {

    content?: Array<{ type?: string; text?: string }>;

  };



  const textBlock = payload.content?.find((block) => block.type === 'text');

  return textBlock?.text?.trim() ?? null;

}



export type SendChatMessageOptions = {

  image?: ChatImageAttachment;

  imageUri?: string;

  onActivity?: (phase: ActivityPhase) => void;

  onToken?: (accumulated: string, delta: string) => void;

  signal?: AbortSignal;

};



export type SendChatMessageResult = {

  userMessage: ChatMessage;

  assistantMessage: ChatMessage;

  quota: ChatQuotaState;

  offlineMode: boolean;

};



export async function sendChatMessage(

  userText: string,

  options?: SendChatMessageOptions,

): Promise<SendChatMessageResult> {

  const trimmed = userText.trim();

  if (!trimmed) {

    throw new Error('Message vide');

  }



  const emitActivity = (phase: ActivityPhase) => {

    options?.onActivity?.(phase);

  };

  const signal = options?.signal;

  throwIfAborted(signal);

  const completedPhases: ActivityPhase[] = [];

  const coldContext = !isChatSessionContextCached();

  if (coldContext) {

    emitActivity('analyse_finances');

  }



  const imageReadPromise =

    options?.imageUri && getGeminiApiKey()

      ? readChatImageAttachment(options.imageUri).catch(() => undefined)

      : Promise.resolve(options?.image);



  const [history, context, imageAttachment] = await Promise.all([

    loadChatHistory(),

    getChatContext(),

    imageReadPromise,

  ]);

  throwIfAborted(signal);



  const pendingAction = isTextConfirmation(trimmed) ? findPendingActionInHistory(history) : null;

  if (pendingAction) {

    return executeTextConfirmation(trimmed, history, pendingAction);

  }



  if (coldContext) {

    completedPhases.push('analyse_finances');

  }

  const { systemPrompt, rfa, dataMode } = context;



  const userMessage: ChatMessage = {

    id: createMessageId('user'),

    role: 'user',

    content: trimmed,

    createdAt: new Date().toISOString(),

    imageUri: options?.imageUri,

  };



  let assistantRaw: string;

  let usedLocalFallback = false;

  emitActivity('reflexion');

  const pendingPlanGoal = findPendingPlanGoalChoice(history);
  if (pendingPlanGoal) {
    throwIfAborted(signal);
    completedPhases.push('reflexion');
    emitActivity('analyse');
    return executePlanGoalFollowUp(trimmed, history, pendingPlanGoal, rfa, completedPhases);
  }

  if (isFinancialPlanRequest(trimmed)) {
    throwIfAborted(signal);
    const planReply = await buildPlanFinancierChatReply(rfa, trimmed);
    completedPhases.push('reflexion');
    emitActivity('analyse');

    const assistantMessage: ChatMessage = {
      id: createMessageId('assistant'),
      role: 'assistant',
      content: planReply.content,
      blocks: planReply.blocks,
      planSuggestions: planReply.planSuggestions,
      planGoalChoice: planReply.planGoalChoice,
      createdAt: new Date().toISOString(),
      activityPhases: completedPhases.length > 0 ? completedPhases : undefined,
    };

    const nextHistory = [...history, userMessage, assistantMessage];
    await saveChatHistory(nextHistory);
    const quota = await incrementQuota(trimmed, assistantMessage.content);

    return {
      userMessage,
      assistantMessage,
      quota,
      offlineMode: false,
    };
  }

  if (isPlanGoalFollowUpMessage(trimmed)) {
    throwIfAborted(signal);
    const goal = detectPlanGoal(trimmed);
    if (goal) {
      const planReply = await buildPlanFinancierChatReply(rfa, trimmed, goal);
      completedPhases.push('reflexion');
      emitActivity('analyse');

      const assistantMessage: ChatMessage = {
        id: createMessageId('assistant'),
        role: 'assistant',
        content: planReply.content,
        blocks: planReply.blocks,
        planSuggestions: planReply.planSuggestions,
        createdAt: new Date().toISOString(),
        activityPhases: completedPhases.length > 0 ? completedPhases : undefined,
      };

      const nextHistory = [...history, userMessage, assistantMessage];
      await saveChatHistory(nextHistory);
      const quota = await incrementQuota(trimmed, assistantMessage.content);

      return {
        userMessage,
        assistantMessage,
        quota,
        offlineMode: false,
      };
    }
  }

  if (getGeminiApiKey()) {

    try {

      assistantRaw = await callGemini(

        systemPrompt,

        history,

        trimmed,

        imageAttachment,

        options?.onToken,

        signal,

      );

    } catch (error) {

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      assistantRaw = buildGeminiFailureReply(error);

    }

  } else if (getAnthropicApiKey()) {

    const fromClaude = await callClaude(systemPrompt, history, trimmed, imageAttachment, signal);

    if (fromClaude) {

      assistantRaw = fromClaude;

    } else {

      assistantRaw = buildLocalFallbackReply(trimmed, rfa, dataMode);

      usedLocalFallback = true;

    }

  } else {

    assistantRaw = buildLocalFallbackReply(trimmed, rfa, dataMode);

    usedLocalFallback = true;

  }

  completedPhases.push('reflexion');



  const { cleanText, actions, blocks } = parseActionsFromResponse(assistantRaw);

  const hasWidgets = blocks.some((block) => block.type !== 'text');



  const assistantMessage: ChatMessage = {

    id: createMessageId('assistant'),

    role: 'assistant',

    content: cleanText || (actions.length > 0 ? '' : 'Je n\'ai pas pu formuler de réponse.'),

    blocks: hasWidgets || (actions.length > 0 && blocks.some((block) => block.type === 'text'))
      ? blocks
      : undefined,

    createdAt: new Date().toISOString(),

    actions: actions.length > 0 ? actions : undefined,

    activityPhases: completedPhases.length > 0 ? completedPhases : undefined,

  };



  const nextHistory = [...history, userMessage, assistantMessage];

  await saveChatHistory(nextHistory);

  const quota = await incrementQuota(trimmed, assistantMessage.content);



  return {

    userMessage,

    assistantMessage,

    quota,

    offlineMode: usedLocalFallback && !isFynChatApiKeyConfigured(),

  };

}



export async function getDataModeLabel(): Promise<string> {

  const mode = await resolveDataMode();

  return mode === 'plaid' ? 'Synchronisation bancaire (Plaid)' : 'Saisie manuelle';

}



// Re-export for UI layer

export { executeChatAction };


