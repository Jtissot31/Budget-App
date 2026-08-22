import type { RecurringPaymentAddVariant } from '@/components/RecurringPaymentsForm';

type Listener = () => void;
type RecurringPaymentListener = (variant: RecurringPaymentAddVariant) => void;
type FynChatSendListener = (text: string) => void;
export type AgendaManageFabState = {
  managing: boolean;
  selectedCount: number;
};
type AgendaManageListener = (state: AgendaManageFabState) => void;
type AgendaPaymentDetailListener = (open: boolean) => void;
const listeners = new Set<Listener>();
const newRecurringPaymentListeners = new Set<RecurringPaymentListener>();
const voiceTransactionListeners = new Set<Listener>();
const fynChatSendListeners = new Set<FynChatSendListener>();
const agendaManageListeners = new Set<AgendaManageListener>();
const agendaDeleteSelectedListeners = new Set<Listener>();
const agendaPaymentDetailListeners = new Set<AgendaPaymentDetailListener>();
let agendaManageFabState: AgendaManageFabState = { managing: false, selectedCount: 0 };
let agendaPaymentDetailOpen = false;

export const dataEvents = {
  emit: () => listeners.forEach((fn) => fn()),
  subscribe: (fn: Listener) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const uiEvents = {
  requestNewRecurringPayment: (variant: RecurringPaymentAddVariant) =>
    newRecurringPaymentListeners.forEach((fn) => fn(variant)),
  subscribeNewRecurringPayment: (fn: RecurringPaymentListener) => {
    newRecurringPaymentListeners.add(fn);
    return () => {
      newRecurringPaymentListeners.delete(fn);
    };
  },
  /** FAB micro (Transactions) → l'onglet ouvre la feuille de dictée. */
  requestVoiceTransaction: () => voiceTransactionListeners.forEach((fn) => fn()),
  subscribeVoiceTransaction: (fn: Listener) => {
    voiceTransactionListeners.add(fn);
    return () => {
      voiceTransactionListeners.delete(fn);
    };
  },
  requestFynChatSend: (text: string) => fynChatSendListeners.forEach((fn) => fn(text)),
  subscribeFynChatSend: (fn: FynChatSendListener) => {
    fynChatSendListeners.add(fn);
    return () => {
      fynChatSendListeners.delete(fn);
    };
  },
  /** Agenda manage mode → FloatingTabBar hides green + / shows delete FAB. */
  setAgendaManageFabState: (state: AgendaManageFabState) => {
    agendaManageFabState = state;
    agendaManageListeners.forEach((fn) => fn(state));
  },
  subscribeAgendaManageFabState: (fn: AgendaManageListener) => {
    agendaManageListeners.add(fn);
    fn(agendaManageFabState);
    return () => {
      agendaManageListeners.delete(fn);
    };
  },
  requestAgendaDeleteSelected: () => agendaDeleteSelectedListeners.forEach((fn) => fn()),
  subscribeAgendaDeleteSelected: (fn: Listener) => {
    agendaDeleteSelectedListeners.add(fn);
    return () => {
      agendaDeleteSelectedListeners.delete(fn);
    };
  },
  /** PaymentDetailSheet overlay → FloatingTabBar hides Agenda + FAB / speed-dial. */
  setAgendaPaymentDetailOpen: (open: boolean) => {
    agendaPaymentDetailOpen = open;
    agendaPaymentDetailListeners.forEach((fn) => fn(open));
  },
  subscribeAgendaPaymentDetailOpen: (fn: AgendaPaymentDetailListener) => {
    agendaPaymentDetailListeners.add(fn);
    fn(agendaPaymentDetailOpen);
    return () => {
      agendaPaymentDetailListeners.delete(fn);
    };
  },
};
