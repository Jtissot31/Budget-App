import type { ExecuteChatActionResult } from './actionExecutor';
import type { ChatAction } from './types';
import type { AlertCardData } from '@/types/aiWidgets';

const TEXT_CONFIRMATIONS = new Set([
  'oui',
  'ok',
  'okay',
  'confirme',
  'confirmé',
  'confirmer',
  'yes',
  'yep',
  "d'accord",
  'daccord',
  'vas-y',
  'vas y',
  'go',
]);

export function isTextConfirmation(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[!.?…]+$/g, '');
  return TEXT_CONFIRMATIONS.has(normalized);
}

export function buildActionResultAlertCard(
  result: ExecuteChatActionResult,
  _action?: ChatAction,
): AlertCardData {
  if (result.ok) {
    return {
      type: 'alert_card',
      severity: 'success',
      title: 'Action confirmée',
      message: result.message,
    };
  }

  return {
    type: 'alert_card',
    severity: 'danger',
    title: 'Action impossible',
    message: result.message,
  };
}

export function alertCardToAssistantContent(alertCard: AlertCardData): string {
  return JSON.stringify(alertCard);
}
