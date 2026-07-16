import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export type AuthenticityCertificateResult = {
  uri: string;
  name: string;
  mimeType: string | null;
  cancelled: boolean;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|gif)$/i;
const PDF_EXT = /\.pdf$/i;

export function isCertificateImageUri(uri: string, mimeType?: string | null): boolean {
  const mime = mimeType?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return true;
  if (mime === 'application/pdf') return false;
  return IMAGE_EXT.test(uri);
}

export function certificateDisplayName(uri: string, fallbackName?: string | null): string {
  const trimmed = fallbackName?.trim();
  if (trimmed) return trimmed;
  try {
    const path = uri.split('?')[0] ?? uri;
    const segment = path.split('/').pop() ?? '';
    const decoded = decodeURIComponent(segment).trim();
    if (decoded) return decoded;
  } catch {
    // ignore decode errors
  }
  return PDF_EXT.test(uri) ? 'Certificat.pdf' : 'Certificat.jpg';
}

export async function pickCertificateFromGallery(): Promise<AuthenticityCertificateResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission requise pour accéder à la galerie.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled) {
    return { uri: '', name: '', mimeType: null, cancelled: true };
  }

  const asset = result.assets[0];
  const uri = asset?.uri ?? '';
  return {
    uri,
    name: certificateDisplayName(uri, asset?.fileName ?? null),
    mimeType: asset?.mimeType ?? null,
    cancelled: false,
  };
}

export async function pickCertificateDocument(): Promise<AuthenticityCertificateResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) {
    return { uri: '', name: '', mimeType: null, cancelled: true };
  }

  const asset = result.assets[0];
  const uri = asset?.uri ?? '';
  return {
    uri,
    name: certificateDisplayName(uri, asset?.name ?? null),
    mimeType: asset?.mimeType ?? null,
    cancelled: false,
  };
}

export function promptAuthenticityCertificateSource(
  onGallery: () => void,
  onDocument: () => void,
  onRemove?: () => void,
) {
  const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
    { text: 'Galerie (JPG)', onPress: onGallery },
    { text: 'Fichier (PDF / image)', onPress: onDocument },
  ];
  if (onRemove) {
    buttons.push({ text: 'Retirer le certificat', onPress: onRemove, style: 'destructive' });
  }
  buttons.push({ text: 'Annuler', style: 'cancel' });
  Alert.alert('Certificat d’authenticité', 'Choisis une source.', buttons);
}
