/** Résumé Financier Anonyme — contexte injecté dans chaque session chat. */

export type DataMode = 'plaid' | 'manual';



export type DetectedProfileType =

  | 'etudiant'

  | 'jeune_travailleur'

  | 'famille'

  | 'retraite'

  | 'inconnu';



export type GlobalSituation = 'saine' | 'tendue' | 'critique';



export type AccountTypeRfa =

  | 'cheque'

  | 'epargne'

  | 'credit'

  | 'investissement'

  | 'pret';



export type DebtTypeRfa =

  | 'carte_credit'

  | 'pret_auto'

  | 'hypotheque'

  | 'marge'

  | 'autre';



export type SubscriptionFrequency = 'mensuel' | 'annuel';



export type AlertSeverity = 'critique' | 'attention' | 'info';



export type AlertCategory =

  | 'fonds_insuffisants'

  | 'budget'

  | 'credit'

  | 'objectif'

  | 'abonnement'

  | 'plan'

  | 'solde_bas'

  | 'autre';



export type AlertAction = 'voir_plan' | 'modifier_budget' | 'voir_compte' | null;



export type PlanStatus = 'actif' | 'pause' | 'complete';



export type PlanTemplateId =

  | 'remboursement_dettes'

  | 'epargne_automatique'

  | 'fonds_urgence'

  | 'optimisation_fiscale'

  | 'remboursement_hypotheque'

  | 'budget_enveloppe';



export type DebtRepaymentMethod = 'avalanche' | 'boule_de_neige' | 'custom';



export type SupportedAiLanguage = 'fr' | 'en' | 'es';



export interface RfaAccount {

  type: AccountTypeRfa;

  institution: string;

  produit: string;

  solde: number;

  limiteCredit?: number;

  tauxUtilisation?: number;

}



export interface RfaDebt {

  type: DebtTypeRfa;

  institution: string;

  solde: number;

  tauxInteret: number;

  paiementMinimum: number;

  prioriteRemboursement: number;

}



export interface RfaSubscription {

  marchand: string;

  montant: number;

  frequence: SubscriptionFrequency;

}



export interface RfaGoal {

  nom: string;

  cible: number;

  progression: number;

  progressionPourcent: number;

  contributionHebdo?: number;

}



export interface RfaActivePlan {

  templateId: PlanTemplateId;

  titre: string;

  statut: PlanStatus;

  progression: number;

  cibleMensuelle?: number;

}



export interface RfaActiveAlert {

  type: AlertSeverity;

  categorie: AlertCategory;

  titre: string;

  message: string;

}



export interface RfaProfile {

  typeDetecte: DetectedProfileType;

  revenuMensuelNet: number;

  depensesMensuellesMoyennes: number;

  tauxEpargneActuel: number;

  situationGlobale: GlobalSituation;

}



export interface FinancialSummaryAnonymous {

  generatedAt: string;

  dataMode: DataMode;

  langue: SupportedAiLanguage;

  profil: RfaProfile;

  comptes: RfaAccount[];

  dettes: RfaDebt[];

  abonnementsDetectes: RfaSubscription[];

  objectifsActifs: RfaGoal[];

  plansFinanciersActifs: RfaActivePlan[];

  alertesActives: RfaActiveAlert[];

  analyse: string;

}



export interface AIAlert {

  id: string;

  type: AlertSeverity;

  categorie: AlertCategory;

  titre: string;

  message: string;

  montant: number | null;

  compteReference: string | null;

  dateEcheance: string | null;

  actionDisponible: AlertAction;

  lu: boolean;

  createdAt: string;

  /** True when dataMode is manual and the alert is based on user-entered data. */

  estimee?: boolean;

}



export interface AIPlanRecommendation {

  templateId: PlanTemplateId;

  priorite: number;

  titre: string;

  cibleMensuelle: number;

  methode?: DebtRepaymentMethod;

  raisonIA: string;

  statut: PlanStatus;

  progression: number;

  dateEstimeeCompletion?: string;

}



export type ChatActionType =

  | 'creer_objectif'

  | 'modifier_objectif'

  | 'creer_categorie_budget'

  | 'modifier_categorie_budget'

  | 'creer_compte'

  | 'modifier_compte'

  | 'creer_marchand'

  | 'modifier_marchand'

  | 'creer_patrimoine'

  | 'modifier_patrimoine'

  | 'creer_pret'

  | 'modifier_pret'

  | 'creer_transaction'

  | 'modifier_transaction'

  | 'creer_paiement_recurrent'

  | 'modifier_paiement_recurrent'

  | 'modifier_plan'

  | 'pause_plan'

  | 'creer_alerte'

  | 'modifier_priorite_dette'

  | 'adapter_dashboard';



/** Référence à une entité existante (modification). */

export interface EntityRefParams {

  id?: string;

  nom?: string;

}



export interface CreerObjectifParams {

  nom: string;

  montant_cible: number;

  montant_actuel?: number;

  contribution_hebdo?: number;

  date_echeance?: string;

}



export interface ModifierObjectifParams extends EntityRefParams {

  nom?: string;

  montant_cible?: number;

  montant_actuel?: number;

  contribution_hebdo?: number;

  date_echeance?: string;

}



export interface CreerCategorieBudgetParams {

  nom: string;

  limite_mensuelle: number;

  limite_hebdomadaire?: number;

  icone?: string;

  couleur?: string;

}



export interface ModifierCategorieBudgetParams extends EntityRefParams {

  nom?: string;

  limite_mensuelle?: number;

  limite_hebdomadaire?: number;

  icone?: string;

  couleur?: string;

}



export interface CreerCompteParams {

  nom: string;

  type?: 'cheque' | 'epargne' | 'credit' | 'cash';

  solde?: number;

  institution?: string;

}



export interface ModifierCompteParams extends EntityRefParams {

  nom?: string;

  type?: 'cheque' | 'epargne' | 'credit' | 'cash';

  solde?: number;

  institution?: string;

}



export interface CreerMarchandParams {

  nom_original: string;

  nom_affichage?: string;

  icone?: string;

  masque?: boolean;

}



export interface ModifierMarchandParams {

  nom_original: string;

  nom_affichage?: string;

  icone?: string;

  masque?: boolean;

}



export interface CreerPatrimoineParams {

  nom: string;

  type?: 'precious_material' | 'real_estate';

  valeur_actuelle: number;

  cout_achat?: number;

  adresse?: string;

  notes?: string;

}



export interface ModifierPatrimoineParams extends EntityRefParams {

  nom?: string;

  type?: 'precious_material' | 'real_estate';

  valeur_actuelle?: number;

  cout_achat?: number;

  adresse?: string;

  notes?: string;

}



export interface CreerPretParams {

  nom: string;

  preteur?: string;

  principal: number;

  solde_restant?: number;

  taux_interet?: number;

  paiement_mensuel?: number;

  compte_id?: string;

  compte_nom?: string;

  date_debut?: string;

  date_fin?: string;

  type?: 'personal_loan' | 'mortgage' | 'line_of_credit' | 'friend_debt';

}



export interface ModifierPretParams extends EntityRefParams {

  nom?: string;

  preteur?: string;

  principal?: number;

  solde_restant?: number;

  taux_interet?: number;

  paiement_mensuel?: number;

  compte_id?: string;

  compte_nom?: string;

  date_debut?: string;

  date_fin?: string;

}



export interface CreerTransactionParams {

  libelle: string;

  montant: number;

  type?: 'depense' | 'revenu' | 'expense' | 'income';

  date?: string;

  categorie_id?: string;

  categorie_nom?: string;

  note?: string;

  facture_uri?: string;

}



export interface ModifierTransactionParams extends EntityRefParams {

  libelle?: string;

  montant?: number;

  type?: 'depense' | 'revenu' | 'expense' | 'income';

  date?: string;

  categorie_id?: string;

  categorie_nom?: string;

  note?: string;

}



export interface CreerPaiementRecurrentParams {

  nom: string;

  montant: number;

  compte_id?: string;

  compte_nom?: string;

  categorie_id?: string;

  categorie_nom?: string;

  frequence?: 'weekly' | 'biweekly' | 'monthly' | 'yearly';

  type?: 'payment' | 'income';

  jour_echeance?: number;

  actif?: boolean;

}



export interface ModifierPaiementRecurrentParams extends EntityRefParams {

  nom?: string;

  montant?: number;

  compte_id?: string;

  compte_nom?: string;

  categorie_id?: string;

  categorie_nom?: string;

  frequence?: 'weekly' | 'biweekly' | 'monthly' | 'yearly';

  type?: 'payment' | 'income';

  jour_echeance?: number;

  actif?: boolean;

}



export type ChatActionParams =

  | CreerObjectifParams

  | ModifierObjectifParams

  | CreerCategorieBudgetParams

  | ModifierCategorieBudgetParams

  | CreerCompteParams

  | ModifierCompteParams

  | CreerMarchandParams

  | ModifierMarchandParams

  | CreerPatrimoineParams

  | ModifierPatrimoineParams

  | CreerPretParams

  | ModifierPretParams

  | CreerTransactionParams

  | ModifierTransactionParams

  | CreerPaiementRecurrentParams

  | ModifierPaiementRecurrentParams

  | Record<string, unknown>;



export interface ChatAction {

  action: ChatActionType;

  params: ChatActionParams;

  confirmation: string;

}



export interface ChatMessage {

  id: string;

  role: 'user' | 'assistant';

  content: string;

  createdAt: string;

  actions?: ChatAction[];

  /** Local URI when user attached an invoice photo. */

  imageUri?: string;

  /** Assistant steps performed while generating this reply. */

  activityPhases?: import('./activityPhases').ActivityPhase[];

}



export type ChatImageAttachment = {

  uri: string;

  base64: string;

  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

};



export interface ChatQuotaState {

  messagesThisMonth: number;

  monthlyLimit: number;

  tokensUsedEstimate: number;

  warningThresholdReached: boolean;

}



export interface RfaRegenerationTrigger {

  reason:

    | 'initial_setup'

    | 'new_plaid_account'

    | 'balance_delta'

    | 'manual_balance_edit'

    | 'plan_change'

    | 'goal_change'

    | 'scheduled';

  detail?: string;

}



export interface PlanTemplateDefinition {

  id: PlanTemplateId;

  titre: string;

  description: string;

  categorie: 'dette' | 'epargne' | 'budget' | 'fiscal';

}


