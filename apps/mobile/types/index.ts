export type TransactionType = 'expense' | 'income' | 'transfer';

export type SyncStatus = 'synced' | 'pending' | 'failed';
export type ReceiptStatus = 'attached' | 'scan_pending';

export type AccountKind = 'credit' | 'checking' | 'savings';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  label: string;
  amount: number;
  type: TransactionType;
  date: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  transactionIcon?: string | null;
  receiptUri?: string | null;
  receiptStatus?: ReceiptStatus | null;
  note?: string;
  /** Optional link to off-balance-sheet wealth_assets row (SQLite migration). */
  wealthAssetId?: string | null;
  /** Optional direct link to a savings goal row (SQLite migration). */
  savingsGoalId?: string | null;
  syncStatus: SyncStatus;
}

export interface CategoryBudget {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  limitAmount: number;
  weeklyLimitAmount?: number | null;
  spent: number;
}

export interface DashboardSummary {
  balance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyBudgetLimit: number;
  recentTransactions: Transaction[];
  topBudgets: CategoryBudget[];
}

export interface MonthlyBudgetSummary {
  month: string;
  expenses: number;
  budgetLimit: number;
}

export interface SimulatedAccount {
  id: string;
  name: string;
  kind: AccountKind;
  balance: number;
  institution?: string;
  last4?: string;
  creditLimit?: number;
  dueDay?: number;
  interestRate?: number;
  logoUrl?: string;
  linkedSavingsGoalId?: string | null;
  hidden?: boolean;
  displayOrder?: number | null;
  createdAt: string;
}

export type WealthAssetType = 'precious_material' | 'real_estate';
export type WealthMaterial = 'gold' | 'silver' | 'diamond' | 'platinum';
export type WealthWeightUnit = 'g' | 'oz' | 'ct';
export type WealthValuationSource = 'market' | 'estimate' | 'manual';

export interface WealthAsset {
  id: string;
  type: WealthAssetType;
  name: string;
  material?: WealthMaterial | null;
  weight?: number | null;
  weightUnit?: WealthWeightUnit | null;
  karats?: number | null;
  purity?: number | null;
  purchaseCost: number;
  purchaseDate?: string | null;
  currentValue: number;
  lastValuationAt?: string | null;
  valuationSource: WealthValuationSource;
  propertyType?: string | null;
  address?: string | null;
  /** Banner photo URI for detail view (real estate). */
  photoUri?: string | null;
  /** Linked mortgage loan id when synced from Dettes & Prêts. */
  linkedLoanId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface MerchantOverride {
  originalName: string;
  displayName?: string | null;
  logoUrl?: string | null;
  icon?: string | null;
  useAutoLogo?: boolean;
  hidden: boolean;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  normalizedName: string;
  isEmployer?: boolean;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  /** Montant déjà épargné à la création (base fixe pour le % « parcours »). */
  initialSavedAmount: number;
  weeklyContribution?: number;
  dueDate?: string;
  color: string;
  icon: string;
  createdAt: string;
}

export type LoanType = 'friend_debt' | 'personal_loan' | 'line_of_credit' | 'mortgage';
export type FriendDebtMode = 'open' | 'payment_plan';
export type LoanDurationUnit = 'months' | 'years';
export type LoanPaymentFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface Loan {
  id: string;
  type: LoanType;
  friendDebtMode?: FriendDebtMode | null;
  name: string;
  /** Purpose label (e.g. Maison, Auto, Rénovation) — combined into display title. */
  reason?: string | null;
  lender: string;
  principal: number;
  balanceRemaining: number;
  interestRate: number;
  monthlyPayment: number;
  startDate: string;
  endDate: string;
  durationAmount: number;
  durationUnit: LoanDurationUnit;
  paymentFrequency: LoanPaymentFrequency;
  paymentAccountId: string;
  nextPaymentDate: string;
  recurringPaymentId?: string | null;
  icon?: string | null;
  /** Mortgage property address (shown in loan detail, not as title). */
  address?: string | null;
  /** Mortgage down payment (mise de fonds). */
  downPayment?: number | null;
  /** Property purchase price at acquisition. */
  purchasePrice?: number | null;
  /** Current estimated property market value. */
  currentPropertyValue?: number | null;
  /** Linked Patrimoine real-estate asset id. */
  wealthAssetId?: string | null;
  createdAt: string;
}

export type RecurringPaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export type RecurringPaymentKind = 'payment' | 'income';

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  kind?: RecurringPaymentKind;
  accountId: string;
  accountLabel: string;
  categoryId?: string | null;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  frequency: RecurringPaymentFrequency;
  dueDay?: number | null;
  nextDate?: string | null;
  endDate?: string | null;
  active: boolean;
  icon: string;
  color: string;
  logoUrl?: string | null;
  createdAt: string;
}
