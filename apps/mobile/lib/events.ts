import type { RecurringPaymentAddVariant } from '@/components/RecurringPaymentsForm';

type Listener = () => void;
type RecurringPaymentListener = (variant: RecurringPaymentAddVariant) => void;
type FynChatSendListener = (text: string) => void;
const listeners = new Set<Listener>();
const newRecurringPaymentListeners = new Set<RecurringPaymentListener>();
const fynChatSendListeners = new Set<FynChatSendListener>();

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
  requestFynChatSend: (text: string) => fynChatSendListeners.forEach((fn) => fn(text)),
  subscribeFynChatSend: (fn: FynChatSendListener) => {
    fynChatSendListeners.add(fn);
    return () => {
      fynChatSendListeners.delete(fn);
    };
  },
};
