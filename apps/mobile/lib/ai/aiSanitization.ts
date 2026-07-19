export const FIELDS_TO_REMOVE = [
  'userId', 'email', 'phone', 'sin', 'firstName', 'lastName', 'fullName', 'address',
  'postalCode', 'dateOfBirth', 'accountNumber', 'routingNumber', 'deviceId', 'ipAddress',
  'apiKey', 'accessToken', 'refreshToken', 'secret', 'password', 'receiptUri', 'photoUri',
  'certificateUri', 'logoUrl',
] as const;

type Sanitizable = Record<string, unknown>;

const SENSITIVE_KEY_PARTS = [
  'apikey', 'accesstoken', 'refreshtoken', 'authorization', 'password', 'secret',
  'accountnumber', 'routingnumber', 'receipturi', 'photouri', 'certificateuri',
] as const;

function isPlainObject(value: unknown): value is Sanitizable {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[_\-\s]/g, '').toLowerCase();
  return (
    (FIELDS_TO_REMOVE as readonly string[]).some(
      (field) => field.toLowerCase() === key.toLowerCase(),
    ) || SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
  );
}

function maskSensitiveNumberSequences(value: string): string {
  return value.replace(/\b(?:\d[\s-]?){12,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 12 ? `•••• ${digits.slice(-4)}` : match;
  });
}

export function sanitizeForAI<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeForAI(item)) as T;
  }
  if (typeof payload === 'string') {
    return maskSensitiveNumberSequences(payload) as T;
  }
  if (!isPlainObject(payload)) {
    return payload;
  }

  const sanitized: Sanitizable = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!isSensitiveKey(key)) {
      sanitized[key] = sanitizeForAI(value);
    }
  }
  return sanitized as T;
}
