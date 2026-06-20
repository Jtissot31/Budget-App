import { readAsStringAsync } from 'expo-file-system/legacy';
import type { ChatImageAttachment } from './types';

function inferMediaType(uri: string): ChatImageAttachment['mediaType'] {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/** Lit une image locale en base64 pour l'API Claude Vision. */
export async function readChatImageAttachment(uri: string): Promise<ChatImageAttachment> {
  const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
  return {
    uri,
    base64,
    mediaType: inferMediaType(uri),
  };
}
