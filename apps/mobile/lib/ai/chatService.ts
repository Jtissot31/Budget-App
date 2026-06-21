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
} from './messageBlocks';

import type { ActivityPhase } from './activityPhases';

import { loadEncryptedJson, removeEncryptedItem, saveEncryptedJson } from './encryptedStorage';

import { getAnthropicApiKey } from './env';

import { loadRFA, regenerateRFA } from './rfaService';

import { resolveDataMode, sanitizeForAI } from './sanitizeForAI';

import type {

  ChatAction,

  ChatActionType,

  ChatImageAttachment,

  ChatMessage,

  ChatQuotaState,

  FinancialSummaryAnonymous,

} from './types';



const CHAT_HISTORY_KEY = 'bt_ai_chat_history_v1';

const CHAT_QUOTA_KEY = 'bt_ai_chat_quota_v1';

const MAX_HISTORY_MESSAGES = 50;

const MONTHLY_MESSAGE_LIMIT = 180;



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
    'Le texte conversationnel reste en prose ; les widgets sont des blocs JSON séparés (```json``` ou objet standalone), parsés par l\'app — jamais affichés bruts.',
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



function buildSystemPrompt(rfa: FinancialSummaryAnonymous, dataMode: 'plaid' | 'manual'): string {

  const manualRule =

    dataMode === 'manual'

      ? '- Les données sont en mode manuel : nuance systématiquement avec « basé sur ce que tu as entré ».'

      : '- Les données sont synchronisées : tu peux être affirmatif et proactive.';



  return [

    'Tu es Fyn, un conseiller financier personnel intégré dans une app de finances personnelles canadienne.',

    'Tu as accès au profil financier complet et anonymisé de l\'utilisateur ci-dessous.',

    '',

    'RÈGLES ABSOLUES :',

    '- Ne jamais demander le nom, email ou informations personnelles de l\'utilisateur',

    '- Toujours répondre dans la langue de l\'utilisateur (FR / EN / ES)',

    '- Adapter ton registre au profil détecté (simple pour débutant, technique pour utilisateur avancé)',

    '- Être direct, honnête, jamais condescendant',

    manualRule,

    '- Ne jamais promettre de rendements ou garantir des résultats',

    '- Si une question dépasse tes capacités (légal, fiscal complexe), recommander un professionnel',

    '- Ne jamais inclure de JSON, code ou blocs techniques dans le texte visible. Les actions passent uniquement via le bloc JSON interne parsé par l\'app.',

    '',

    buildActionCapabilitiesSection(),

    '',

    buildWidgetCapabilitiesSection(),

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



  const plainFromBlocks = messageBlocksToPlainText(blocks);

  return {
    cleanText: plainFromBlocks || stripCodeFromAssistantText(text),
    actions,
    blocks,
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

    offlineMode: !getAnthropicApiKey(),

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

}



export async function getChatQuotaState(): Promise<ChatQuotaState> {

  const stored = await loadEncryptedJson<ChatQuotaState>(CHAT_QUOTA_KEY);

  const now = new Date();

  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;



  if (!stored || !('monthKey' in (stored as object))) {

    return {

      messagesThisMonth: 0,

      monthlyLimit: MONTHLY_MESSAGE_LIMIT,

      tokensUsedEstimate: 0,

      warningThresholdReached: false,

    };

  }



  const withMonth = stored as ChatQuotaState & { monthKey?: string };

  if (withMonth.monthKey !== monthKey) {

    return {

      messagesThisMonth: 0,

      monthlyLimit: MONTHLY_MESSAGE_LIMIT,

      tokensUsedEstimate: 0,

      warningThresholdReached: false,

    };

  }



  return {

    messagesThisMonth: withMonth.messagesThisMonth,

    monthlyLimit: MONTHLY_MESSAGE_LIMIT,

    tokensUsedEstimate: withMonth.tokensUsedEstimate,

    warningThresholdReached: withMonth.messagesThisMonth >= MONTHLY_MESSAGE_LIMIT * 0.85,

  };

}



async function incrementQuota(userText: string, assistantText: string): Promise<ChatQuotaState> {

  const now = new Date();

  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

  const current = await getChatQuotaState();

  const next: ChatQuotaState & { monthKey: string } = {

    messagesThisMonth: current.messagesThisMonth + 1,

    monthlyLimit: MONTHLY_MESSAGE_LIMIT,

    tokensUsedEstimate: current.tokensUsedEstimate + Math.ceil((userText.length + assistantText.length) / 4),

    warningThresholdReached: current.messagesThisMonth + 1 >= MONTHLY_MESSAGE_LIMIT * 0.85,

    monthKey,

  };

  await saveEncryptedJson(CHAT_QUOTA_KEY, next);

  return next;

}



function buildDemoActionForMessage(userText: string): ChatAction | null {

  const normalized = userText.toLowerCase();

  if (normalized.includes('objectif') && (normalized.includes('cré') || normalized.includes('cre') || normalized.includes('ajout'))) {

    return {

      action: 'creer_objectif',

      params: { nom: 'Vacances', montant_cible: 5000, montant_actuel: 0 },

      confirmation: "Créer l'objectif Vacances (5 000 $)?",

    };

  }

  if (normalized.includes('transaction') || normalized.includes('facture') || normalized.includes('dépense') || normalized.includes('depense')) {

    return {

      action: 'creer_transaction',

      params: {

        libelle: 'Dépense démo',

        montant: 42.5,

        type: 'depense',

        date: new Date().toISOString().slice(0, 10),

      },

      confirmation: 'Enregistrer la dépense démo (42,50 $)?',

    };

  }

  if (normalized.includes('compte') && (normalized.includes('cré') || normalized.includes('cre') || normalized.includes('ajout'))) {

    return {

      action: 'creer_compte',

      params: { nom: 'Compte démo', type: 'cheque', solde: 0 },

      confirmation: 'Créer le compte démo?',

    };

  }

  return null;

}



function buildOfflineAssistantReply(

  userText: string,

  rfa: FinancialSummaryAnonymous,

  dataMode: 'plaid' | 'manual',

): string {

  const prefix =

    dataMode === 'manual'

      ? 'Basé sur ce que tu as entré, '

      : '';



  const normalized = userText.toLowerCase();

  const demoAction = buildDemoActionForMessage(userText);



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



  const intro = [

    'Mode démo — configure EXPO_PUBLIC_ANTHROPIC_API_KEY pour activer Fyn.',

    rfa.analyse,

    'Pose-moi une question sur ton budget, tes dettes ou tes objectifs.',

  ].join(' ');



  if (demoAction) {

    return `${intro}\n\n${JSON.stringify(demoAction)}`;

  }



  return intro;

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



async function callClaude(

  systemPrompt: string,

  history: ChatMessage[],

  userText: string,

  image?: ChatImageAttachment,

): Promise<string | null> {

  const apiKey = getAnthropicApiKey();

  if (!apiKey) return null;



  const messages: AnthropicMessage[] = [

    ...history

      .filter((message) => message.role === 'user' || message.role === 'assistant')

      .map((message) => ({

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

      max_tokens: 1024,

      system: systemPrompt,

      messages,

    }),

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

  const completedPhases: ActivityPhase[] = [];



  emitActivity('analyse_finances');

  const [history, rfaExisting, dataMode] = await Promise.all([

    loadChatHistory(),

    loadRFA(),

    resolveDataMode(),

  ]);



  const pendingAction = isTextConfirmation(trimmed) ? findPendingActionInHistory(history) : null;

  if (pendingAction) {

    return executeTextConfirmation(trimmed, history, pendingAction);

  }



  const rfa = rfaExisting ?? (await regenerateRFA({ reason: 'initial_setup' }));

  completedPhases.push('analyse_finances');

  const systemPrompt = buildSystemPrompt(rfa, dataMode);



  const userMessage: ChatMessage = {

    id: createMessageId('user'),

    role: 'user',

    content: trimmed,

    createdAt: new Date().toISOString(),

    imageUri: options?.imageUri,

  };



  let assistantRaw: string;

  emitActivity('reflexion');

  if (!getAnthropicApiKey()) {

    assistantRaw = buildOfflineAssistantReply(trimmed, rfa, dataMode);

  } else {

    assistantRaw =

      (await callClaude(systemPrompt, history, trimmed, options?.image)) ??

      buildOfflineAssistantReply(trimmed, rfa, dataMode);

  }

  completedPhases.push('reflexion');



  emitActivity('analyse');

  const { cleanText, actions, blocks } = parseActionsFromResponse(assistantRaw);

  const hasWidgets = blocks.some((block) => block.type !== 'text');

  completedPhases.push('analyse');



  emitActivity('redaction');

  const assistantMessage: ChatMessage = {

    id: createMessageId('assistant'),

    role: 'assistant',

    content: cleanText || 'Je n\'ai pas pu formuler de réponse.',

    blocks: hasWidgets ? blocks : undefined,

    createdAt: new Date().toISOString(),

    actions: actions.length > 0 ? actions : undefined,

    activityPhases: [...completedPhases, 'redaction'],

  };

  completedPhases.push('redaction');



  const nextHistory = [...history, userMessage, assistantMessage];

  await saveChatHistory(nextHistory);

  const quota = await incrementQuota(trimmed, assistantMessage.content);



  return {

    userMessage,

    assistantMessage,

    quota,

    offlineMode: !getAnthropicApiKey(),

  };

}



export async function getDataModeLabel(): Promise<string> {

  const mode = await resolveDataMode();

  return mode === 'plaid' ? 'Synchronisation bancaire (Plaid)' : 'Saisie manuelle';

}



// Re-export for UI layer

export { executeChatAction };


