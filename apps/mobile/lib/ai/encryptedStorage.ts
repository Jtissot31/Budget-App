import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSecureItemAsync, setSecureItemAsync } from '@/lib/secureStorage';

const ENCRYPTION_KEY_ALIAS = 'bt_ai_storage_key_v1';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getOrCreateCryptoKey(): Promise<CryptoKey | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;

  const stored = await getSecureItemAsync(ENCRYPTION_KEY_ALIAS);
  if (stored) {
    const raw = base64ToBytes(stored);
    return subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const exported = await subtle.exportKey('raw', key);
  await setSecureItemAsync(ENCRYPTION_KEY_ALIAS, bytesToBase64(new Uint8Array(exported)));
  return key;
}

async function encryptPayload(plainText: string): Promise<string> {
  const key = await getOrCreateCryptoKey();
  const subtle = globalThis.crypto?.subtle;
  if (!key || !subtle) {
    return `plain:${plainText}`;
  }

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipher = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return `aes:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
}

async function decryptPayload(stored: string): Promise<string | null> {
  if (stored.startsWith('plain:')) {
    return stored.slice('plain:'.length);
  }

  if (!stored.startsWith('aes:')) return null;

  const [, ivB64, cipherB64] = stored.split(':');
  if (!ivB64 || !cipherB64) return null;

  const key = await getOrCreateCryptoKey();
  const subtle = globalThis.crypto?.subtle;
  if (!key || !subtle) return null;

  try {
    const iv = base64ToBytes(ivB64);
    const cipher = base64ToBytes(cipherB64);
    const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export async function loadEncryptedJson<T>(storageKey: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return null;

  const decrypted = await decryptPayload(raw);
  if (!decrypted) return null;

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}

export async function saveEncryptedJson<T>(storageKey: string, value: T): Promise<void> {
  const encrypted = await encryptPayload(JSON.stringify(value));
  await AsyncStorage.setItem(storageKey, encrypted);
}

export async function removeEncryptedItem(storageKey: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey);
}
