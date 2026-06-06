export type FormFeedbackVariant = 'error' | 'success' | 'warning';

export type FormFeedback = {
  variant: FormFeedbackVariant;
  title: string;
  message: string;
};

/** `true` when save succeeded; otherwise themed feedback for the form. */
export type FormSaveResult = true | FormFeedback;

export function formValidationError(title: string, message: string): FormFeedback {
  return { variant: 'error', title, message };
}

export function isFormSaveSuccess(result: FormSaveResult): result is true {
  return result === true;
}
