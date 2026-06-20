import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

export type SaveReceiptResult = {
  method: 'photos' | 'share';
};

function guessReceiptMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function guessReceiptFileName(uri: string, suggestedName?: string): string {
  if (suggestedName?.trim()) return suggestedName.trim();
  const fromPath = uri.split('/').pop()?.split('?')[0];
  if (fromPath?.includes('.')) return fromPath;
  const ext = guessReceiptMimeType(uri) === 'image/png' ? 'png' : 'jpg';
  return `recu-${Date.now()}.${ext}`;
}

function hasFileExtension(uri: string): boolean {
  const fileName = uri.split('/').pop()?.split('?')[0] ?? '';
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 && lastDot < fileName.length - 1;
}

function cacheFilePath(fileName: string): string {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) {
    throw new Error('Stockage temporaire indisponible sur cet appareil.');
  }
  return `${cacheDirectory}${fileName}`;
}

async function copyUriToCache(sourceUri: string, suggestedName?: string): Promise<string> {
  const destination = cacheFilePath(guessReceiptFileName(sourceUri, suggestedName));
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  const info = await FileSystem.getInfoAsync(destination);
  if (!info.exists) {
    throw new Error('Impossible de préparer le reçu pour l’enregistrement.');
  }
  return destination;
}

async function resolveShareableReceiptUri(uri: string, suggestedName?: string): Promise<string> {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error('Aucun reçu à télécharger.');
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const destination = cacheFilePath(guessReceiptFileName(trimmed, suggestedName));
    const downloaded = await FileSystem.downloadAsync(trimmed, destination);
    if (!downloaded.uri) {
      throw new Error('Le téléchargement du reçu a échoué.');
    }
    return downloaded.uri;
  }

  if (trimmed.startsWith('content:')) {
    return copyUriToCache(trimmed, suggestedName);
  }

  if (trimmed.startsWith('file:')) {
    if (hasFileExtension(trimmed)) {
      const info = await FileSystem.getInfoAsync(trimmed);
      if (!info.exists) {
        throw new Error('Le fichier du reçu est introuvable.');
      }
      return trimmed;
    }
    return copyUriToCache(trimmed, suggestedName);
  }

  if (trimmed.startsWith('/')) {
    const fileUri = Platform.OS === 'android' ? `file://${trimmed}` : `file://${trimmed}`;
    if (hasFileExtension(fileUri)) {
      return fileUri;
    }
    return copyUriToCache(fileUri, suggestedName);
  }

  throw new Error('Ce reçu ne peut pas être téléchargé.');
}

function isMediaLibraryUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'UnavailabilityError' || /MediaLibrary/i.test(error.message);
}

async function requestPhotoLibraryWritePermission(): Promise<boolean> {
  const granularPermissions = Platform.OS === 'android' ? (['photo'] as MediaLibrary.GranularPermission[]) : undefined;
  const { status } = await MediaLibrary.requestPermissionsAsync(true, granularPermissions);
  return status === 'granted';
}

async function mediaLibraryAssetUri(localUri: string, suggestedName?: string): Promise<string> {
  // MediaLibrary on Android requires a file:/// path with a file extension.
  if (Platform.OS === 'android' || localUri.startsWith('content:') || !hasFileExtension(localUri)) {
    return copyUriToCache(localUri, suggestedName);
  }
  return localUri;
}

async function saveLocalReceiptToPhotos(localUri: string, suggestedName?: string): Promise<boolean> {
  const available = await MediaLibrary.isAvailableAsync();
  if (!available) return false;

  const granted = await requestPhotoLibraryWritePermission();
  if (!granted) return false;

  const assetUri = await mediaLibraryAssetUri(localUri, suggestedName);

  try {
    await MediaLibrary.createAssetAsync(assetUri);
    return true;
  } catch (error) {
    if (isMediaLibraryUnavailable(error)) return false;
    throw error;
  }
}

async function shareLocalReceipt(localUri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Le partage n’est pas disponible sur cet appareil.');
  }

  await Sharing.shareAsync(localUri, {
    mimeType: guessReceiptMimeType(localUri),
    dialogTitle: 'Enregistrer le reçu',
    UTI: 'public.image',
  });
}

export function receiptDownloadErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export async function saveReceiptToPhotos(uri: string, suggestedName?: string): Promise<SaveReceiptResult> {
  const localUri = await resolveShareableReceiptUri(uri, suggestedName);

  try {
    const savedToPhotos = await saveLocalReceiptToPhotos(localUri, suggestedName);
    if (savedToPhotos) {
      return { method: 'photos' };
    }
  } catch (error) {
    if (!isMediaLibraryUnavailable(error)) {
      throw error;
    }
  }

  await shareLocalReceipt(localUri);
  return { method: 'share' };
}

export async function shareReceiptImage(uri: string, suggestedName?: string): Promise<void> {
  const localUri = await resolveShareableReceiptUri(uri, suggestedName);
  await shareLocalReceipt(localUri);
}
