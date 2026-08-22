/**
 * Transcription vocale — clip local (expo-audio) → texte, via Gemini Flash.
 *
 * On réutilise le client Gemini déjà en place (clé `EXPO_PUBLIC_GEMINI_API_KEY` /
 * BYOK SecureStore) : aucun module natif de speech-to-text n'est requis, donc
 * l'enregistrement **et** la transcription fonctionnent dans Expo Go.
 */

import { readAsStringAsync } from 'expo-file-system/legacy';
import { GeminiApiError, generateGeminiFromAudio, isGeminiAvailable } from './geminiClient';

/** Réponse convenue quand le clip ne contient aucune parole exploitable. */
const NO_SPEECH_MARKER = 'aucune parole';

const TRANSCRIPTION_PROMPT = [
  'Transcris mot à mot cet enregistrement en français québécois.',
  'Réponds UNIQUEMENT avec la transcription : aucun préambule, aucun guillemet, aucun commentaire.',
  'Écris les montants en chiffres avec le symbole dollar (ex. « 50$ », « 12,50$ »).',
  'Conserve les noms de commerces et de cartes tels que prononcés (ex. « Petro-Canada », « Visa Desjardins »).',
  `Si l'audio ne contient aucune parole compréhensible, réponds exactement : ${NO_SPEECH_MARKER}`,
].join('\n');

/**
 * `expo-audio` produit du AAC dans un conteneur .m4a. Gemini documente `audio/mp4`
 * et `audio/aac` selon les surfaces — on tente le premier, puis l'autre si le type est refusé.
 */
const AUDIO_MIME_CANDIDATES = ['audio/mp4', 'audio/aac'] as const;

export type TranscriptionFailureKind = 'no-api-key' | 'no-speech' | 'network';

export class TranscriptionError extends Error {
  readonly kind: TranscriptionFailureKind;

  constructor(kind: TranscriptionFailureKind, message: string) {
    super(message);
    this.name = 'TranscriptionError';
    this.kind = kind;
  }
}

function looksLikeUnsupportedMimeType(error: unknown): boolean {
  if (!(error instanceof GeminiApiError)) return false;
  if (error.status !== 400) return false;
  const message = error.message.toLowerCase();
  return message.includes('mime') || message.includes('unsupported') || message.includes('invalid argument');
}

/** Gemini répond parfois « (aucune parole) » ou avec des guillemets — on normalise. */
function cleanTranscript(raw: string): string {
  return raw
    .trim()
    .replace(/^["'«»\s]+|["'«»\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoSpeech(transcript: string): boolean {
  const normalized = transcript
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length === 0 || normalized === NO_SPEECH_MARKER;
}

/** True quand la dictée vocale est utilisable (clé Gemini présente). */
export function isSpeechTranscriptionAvailable(): boolean {
  return isGeminiAvailable();
}

/**
 * Transcrit un fichier audio local. Lance `TranscriptionError` :
 * `no-api-key` (clé absente), `no-speech` (silence), `network` (appel échoué).
 */
export async function transcribeSpeechFromFile(uri: string, signal?: AbortSignal): Promise<string> {
  if (!isGeminiAvailable()) {
    throw new TranscriptionError('no-api-key', 'Clé API Gemini absente');
  }

  let base64: string;
  try {
    base64 = await readAsStringAsync(uri, { encoding: 'base64' });
  } catch (error) {
    throw new TranscriptionError(
      'network',
      `Lecture du clip impossible : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  }

  if (!base64) throw new TranscriptionError('no-speech', 'Clip audio vide');

  let lastError: unknown = null;

  for (const mimeType of AUDIO_MIME_CANDIDATES) {
    try {
      const raw = await generateGeminiFromAudio({
        base64,
        mimeType,
        prompt: TRANSCRIPTION_PROMPT,
        signal,
      });

      const transcript = cleanTranscript(raw);
      if (isNoSpeech(transcript)) {
        throw new TranscriptionError('no-speech', 'Aucune parole détectée');
      }
      return transcript;
    } catch (error) {
      if (error instanceof TranscriptionError) throw error;
      lastError = error;
      if (looksLikeUnsupportedMimeType(error)) continue;
      break;
    }
  }

  const detail =
    lastError instanceof GeminiApiError
      ? lastError.userMessage
      : lastError instanceof Error
        ? lastError.message
        : 'erreur inconnue';
  throw new TranscriptionError('network', `Transcription impossible : ${detail}`);
}
