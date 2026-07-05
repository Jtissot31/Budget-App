/** Thrown by onSave when the parent already surfaced feedback (Alert, modal, etc.). */
export class HandledSaveError extends Error {
  constructor() {
    super('handled save error');
    this.name = 'HandledSaveError';
  }
}

export function isHandledSaveError(error: unknown): error is HandledSaveError {
  return error instanceof HandledSaveError;
}
