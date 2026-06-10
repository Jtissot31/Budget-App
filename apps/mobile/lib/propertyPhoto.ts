import { Alert } from 'react-native';
import { captureReceiptPhoto, pickReceiptFromGallery } from '@/lib/receiptCapture';

export type PropertyPhotoResult = {
  uri: string;
  cancelled: boolean;
};

export async function pickPropertyPhotoFromGallery(): Promise<PropertyPhotoResult> {
  const result = await pickReceiptFromGallery();
  return { uri: result.uri, cancelled: result.cancelled };
}

export async function capturePropertyPhoto(): Promise<PropertyPhotoResult> {
  const result = await captureReceiptPhoto();
  return { uri: result.uri, cancelled: result.cancelled };
}

export function promptPropertyPhotoSource(
  onGallery: () => void,
  onCamera: () => void,
  onRemove?: () => void,
) {
  const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
    { text: 'Galerie', onPress: onGallery },
    { text: 'Caméra', onPress: onCamera },
  ];
  if (onRemove) {
    buttons.push({ text: 'Retirer la photo', onPress: onRemove, style: 'destructive' });
  }
  buttons.push({ text: 'Annuler', style: 'cancel' });
  Alert.alert('Photo du bien', 'Choisis une source.', buttons);
}
