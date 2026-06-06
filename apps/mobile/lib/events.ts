type Listener = () => void;
const listeners = new Set<Listener>();
const newRecurringPaymentListeners = new Set<Listener>();

export const dataEvents = {
  emit: () => listeners.forEach((fn) => fn()),
  subscribe: (fn: Listener) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const uiEvents = {
  requestNewRecurringPayment: () => newRecurringPaymentListeners.forEach((fn) => fn()),
  subscribeNewRecurringPayment: (fn: Listener) => {
    newRecurringPaymentListeners.add(fn);
    return () => newRecurringPaymentListeners.delete(fn);
  },
};
