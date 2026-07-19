/**
 * Shared Gemini Flash client — EXPO_PUBLIC_GEMINI_API_KEY via lib/ai/env.ts.
 * Dev-only in bundle; production should use a server proxy.
 */
import { createAbortError, isAbortError } from '@/lib/abortError';
import { getGeminiApiKey } from './env';

/** Tracks Google's latest Flash alias — avoids deprecated model IDs (e.g. gemini-2.5-flash). */
export const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_STREAM_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent`;

type GeminiResponsePayload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; status?: string; code?: number };
};

export class GeminiApiError extends Error {
  readonly status?: number;
  readonly userMessage: string;

  constructor(message: string, options?: { status?: number; userMessage?: string }) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = options?.status;
    this.userMessage = options?.userMessage ?? message;
  }
}

function extractGeminiText(payload: GeminiResponsePayload): string | null {
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text || null;
}

function buildGeminiFailure(
  payload: GeminiResponsePayload,
  httpStatus: number,
): GeminiApiError {
  const apiMessage = payload.error?.message?.trim();
  const finishReason = payload.candidates?.[0]?.finishReason;

  if (apiMessage) {
    return new GeminiApiError(apiMessage, {
      status: httpStatus,
      userMessage: apiMessage,
    });
  }

  if (finishReason === 'MAX_TOKENS') {
    return new GeminiApiError('Réponse tronquée (limite de tokens)', {
      status: httpStatus,
      userMessage: 'réponse tronquée',
    });
  }

  return new GeminiApiError(`Requête Gemini échouée (${httpStatus})`, {
    status: httpStatus,
    userMessage: `erreur ${httpStatus}`,
  });
}

async function postGemini(
  apiKey: string,
  body: Record<string, unknown>,
  options?: { throwOnFailure?: boolean; signal?: AbortSignal },
): Promise<string | null> {
  const throwOnFailure = options?.throwOnFailure ?? false;

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'réseau indisponible';
    if (throwOnFailure) {
      throw new GeminiApiError(message, { userMessage: 'connexion impossible' });
    }
    if (__DEV__) console.warn('[geminiClient] fetch failed:', message);
    return null;
  }

  const payload = (await response.json()) as GeminiResponsePayload;
  const text = extractGeminiText(payload);

  if (response.ok && text) return text;

  const failure = buildGeminiFailure(payload, response.status);
  if (__DEV__) console.warn('[geminiClient]', failure.message);

  if (throwOnFailure) throw failure;
  return null;
}

export type GeminiGenerateOptions = {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
};

/** Returns trimmed text from Gemini, or null when key missing / request fails. */
export async function generateGeminiContent(options: GeminiGenerateOptions): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const { prompt, temperature = 0.35, maxOutputTokens = 256, responseMimeType } = options;

  return postGemini(apiKey, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(responseMimeType ? { responseMimeType } : {}),
    },
  });
}

export function isGeminiAvailable(): boolean {
  return Boolean(getGeminiApiKey());
}

export type GeminiChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type GeminiChatImage = {
  base64: string;
  mediaType: string;
};

export type GeminiChatOptions = {
  systemInstruction: string;
  history: GeminiChatTurn[];
  userText: string;
  image?: GeminiChatImage;
  temperature?: number;
  maxOutputTokens?: number;
  onToken?: (accumulated: string, delta: string) => void;
  signal?: AbortSignal;
};

function buildGeminiChatBody(options: GeminiChatOptions): Record<string, unknown> {
  const { systemInstruction, history, userText, image, temperature = 0.35, maxOutputTokens = 1024 } =
    options;

  const userParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  if (image) {
    userParts.push({
      inlineData: {
        mimeType: image.mediaType,
        data: image.base64,
      },
    });
  }
  userParts.push({ text: userText });

  const contents: Array<{
    role: string;
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  }> = [
    ...history.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    })),
    { role: 'user', parts: userParts },
  ];

  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens,
      // Skip extended "thinking" on Flash 2.5+ for faster first token.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}

async function readGeminiSseStream(
  response: Response,
  onToken: (accumulated: string, delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new GeminiApiError('Streaming non supporté', { userMessage: 'streaming indisponible' });
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      throw createAbortError();
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      try {
        const payload = JSON.parse(jsonStr) as GeminiResponsePayload;
        const delta = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!delta) continue;
        accumulated += delta;
        onToken(accumulated, delta);
      } catch {
        // Ignore malformed SSE chunks.
      }
    }
  }

  return accumulated.trim();
}

function stripThinkingConfig(body: Record<string, unknown>): Record<string, unknown> {
  const generationConfig = body.generationConfig;
  if (!generationConfig || typeof generationConfig !== 'object') return body;

  const { thinkingConfig: _removed, ...rest } = generationConfig as Record<string, unknown>;
  return { ...body, generationConfig: rest };
}

async function postGeminiChat(
  apiKey: string,
  body: Record<string, unknown>,
  options?: {
    throwOnFailure?: boolean;
    stream?: boolean;
    onToken?: (accumulated: string, delta: string) => void;
    signal?: AbortSignal;
  },
): Promise<string | null> {
  const throwOnFailure = options?.throwOnFailure ?? false;

  try {
    if (options?.stream && options.onToken) {
      return await postGeminiStream(apiKey, body, options.onToken, options.signal);
    }
    return await postGemini(apiKey, body, { throwOnFailure, signal: options?.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    const hasThinkingConfig = Boolean(
      (body.generationConfig as Record<string, unknown> | undefined)?.thinkingConfig,
    );

    if (error instanceof GeminiApiError && error.status === 400 && hasThinkingConfig) {
      const retryBody = stripThinkingConfig(body);
      return postGeminiChat(apiKey, retryBody, { ...options, stream: false });
    }

    if (options?.stream && options.onToken) {
      if (__DEV__) {
        console.warn('[geminiClient] stream failed, falling back to generateContent:', error);
      }
      return await postGemini(apiKey, body, { throwOnFailure });
    }

    if (throwOnFailure) throw error;
    return null;
  }
}

async function postGeminiStream(
  apiKey: string,
  body: Record<string, unknown>,
  onToken: (accumulated: string, delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${GEMINI_STREAM_ENDPOINT}?alt=sse&key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'réseau indisponible';
    throw new GeminiApiError(message, { userMessage: 'connexion impossible' });
  }

  if (!response.ok) {
    const payload = (await response.json()) as GeminiResponsePayload;
    throw buildGeminiFailure(payload, response.status);
  }

  const text = await readGeminiSseStream(response, onToken, signal);
  if (!text) {
    throw new GeminiApiError('Réponse Gemini vide', { userMessage: 'réponse vide' });
  }

  return text;
}

/** Multi-turn chat with system instruction — used by Fyn advisor. Throws GeminiApiError on failure. */
export async function generateGeminiChat(options: GeminiChatOptions): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiApiError('Clé API Gemini absente', { userMessage: 'clé API absente' });
  }

  const body = buildGeminiChatBody(options);

  const text = await postGeminiChat(apiKey, body, {
    throwOnFailure: true,
    stream: Boolean(options.onToken),
    onToken: options.onToken,
    signal: options.signal,
  });

  if (!text) {
    throw new GeminiApiError('Réponse Gemini vide', { userMessage: 'réponse vide' });
  }

  return text;
}
