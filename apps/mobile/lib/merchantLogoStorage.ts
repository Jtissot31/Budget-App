import * as FileSystem from 'expo-file-system/legacy';
import { normalizeMerchantKey } from '@/lib/merchantLogo';

const MERCHANT_LOGO_DIR = 'merchant-logos';

function guessLogoExtension(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'png';
  if (lower.includes('.webp')) return 'webp';
  if (lower.includes('.heic') || lower.includes('.heif')) return 'heic';
  return 'jpg';
}

function merchantLogoFileStem(merchantName: string): string {
  const key = normalizeMerchantKey(merchantName)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return key || 'merchant';
}

/** Copy a picked image into app document storage so merchant logos survive restarts. */
export async function persistMerchantLogoUri(sourceUri: string, merchantName: string): Promise<string> {
  const trimmed = sourceUri.trim();
  if (!trimmed) {
    throw new Error('Image invalide.');
  }

  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    return trimmed;
  }

  const destination = `${documentDirectory}${MERCHANT_LOGO_DIR}/${merchantLogoFileStem(merchantName)}.${guessLogoExtension(trimmed)}`;
  if (trimmed.startsWith(documentDirectory)) {
    return trimmed;
  }

  await FileSystem.makeDirectoryAsync(`${documentDirectory}${MERCHANT_LOGO_DIR}/`, { intermediates: true });
  await FileSystem.copyAsync({ from: trimmed, to: destination });
  const info = await FileSystem.getInfoAsync(destination);
  if (!info.exists) {
    throw new Error('Impossible d’enregistrer le logo du marchand.');
  }
  return destination;
}
