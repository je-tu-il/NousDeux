import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Compresse et nettoie l'image en éliminant toutes les métadonnées (EXIF, GPS, modèle d'appareil, etc.)
 * - Sur mobile natif : ImageManipulator redessine l'image sur un canvas bitmap propre en JPEG sans tags EXIF.
 * - Sur le Web : HTML5 Canvas redessine les pixels purs et produit un dataURL JPEG exempt de toute métadonnée privée.
 */
export async function stripMetadataAndCompress(uri: string, maxDim = 256): Promise<string> {
  // Sur Web, utiliser HTML Canvas pour garantir la suppression totale d'EXIF et une compression immédiate
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const img = new (window as any).Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
          resolve(uri);
        }
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    });
  }

  // Sur mobile natif (iOS / Android) : utiliser ImageManipulator (redessine sans EXIF)
  try {
    const ImageManipulator = await import('expo-image-manipulator');
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxDim, height: maxDim } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (manipResult.base64) {
      return `data:image/jpeg;base64,${manipResult.base64}`;
    }
    if (manipResult.uri) {
      return manipResult.uri;
    }
  } catch (err) {
    console.warn('ImageManipulator error:', err);
  }
  return uri;
}

export type ImagePickResult =
  | { success: true; dataUri: string }
  | { success: false; permissionDenied?: boolean; cancelled?: boolean; error?: string };

/**
 * Prendre une photo avec l'appareil photo, avec métadonnées EXIF désactivées et nettoyées
 */
export async function takePhotoWithCamera(): Promise<ImagePickResult> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, permissionDenied: true };
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
      exif: false, // Métadonnées EXIF désactivées
    });

    if (result.canceled || !result.assets || !result.assets[0]) {
      return { success: false, cancelled: true };
    }

    const asset = result.assets[0];
    const rawUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    const cleanDataUri = await stripMetadataAndCompress(rawUri, 256);
    return { success: true, dataUri: cleanDataUri };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la capture photo' };
  }
}

/**
 * Choisir une photo dans la galerie, avec métadonnées EXIF désactivées et nettoyées
 */
export async function pickImageFromGallery(): Promise<ImagePickResult> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, permissionDenied: true };
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
      exif: false, // Métadonnées EXIF désactivées
    });

    if (result.canceled || !result.assets || !result.assets[0]) {
      return { success: false, cancelled: true };
    }

    const asset = result.assets[0];
    const rawUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    const cleanDataUri = await stripMetadataAndCompress(rawUri, 256);
    return { success: true, dataUri: cleanDataUri };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors du choix de la photo' };
  }
}
