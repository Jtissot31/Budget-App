import type { RecurringPaymentAddVariant } from '@/components/RecurringPaymentsForm';

type Listener = () => void;
type RecurringPaymentListener = (variant: RecurringPaymentAddVariant) => void;
const listeners = new Set<Listener>();
const newRecurringPaymentListeners = new Set<RecurringPaymentListener>();

export const dataEvents = {
  emit: () => listeners.forEach((fn) => fn()),
  subscribe: (fn: Listener) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const uiEvents = {
  requestNewRecurringPayment: (variant: RecurringPaymentAddVariant) =>
    newRecurringPaymentListeners.forEach((fn) => fn(variant)),
  subscribeNewRecurringPayment: (fn: RecurringPaymentListener) => {
    newRecurringPaymentListeners.add(fn);
    return () => newRecurringPaymentListeners.delete(fn);
  },
};
