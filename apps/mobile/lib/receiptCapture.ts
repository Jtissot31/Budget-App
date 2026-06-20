import * as ImagePicker from 'expo-image-picker';

export type ReceiptImageResult = {
  uri: string;
  cancelled: boolean;
};

export async function pickReceiptFromGallery(): Promise<ReceiptImageResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission requise pour accéder à la galerie.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled) return { uri: '', cancelled: true };
  return { uri: result.assets[0]?.uri ?? '', cancelled: false };
}

export async function captureReceiptPhoto(): Promise<ReceiptImageResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission requise pour accéder à la caméra.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled) return { uri: '', cancelled: true };
  return { uri: result.assets[0]?.uri ?? '', cancelled: false };
}
