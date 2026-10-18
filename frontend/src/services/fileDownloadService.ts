import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { storage } from './storage';
import { resolveDownloadUrl } from './externalPdfViewerService';

/**
 * Downloads a PDF file from a remote or local URI into the application's document directory.
 * If already downloaded, returns existing local path.
 * Requires genuine download success; never generates mock or fake files.
 */
export async function downloadPdfFile(
  fileUrl: string, 
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const localDir = `${FileSystem.documentDirectory}studyhub_notes/`;

  // Ensure directory exists
  const dirInfo = await FileSystem.getInfoAsync(localDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(localDir, { intermediates: true });
  }

  const localPath = `${localDir}${sanitizedName.endsWith('.pdf') ? sanitizedName : `${sanitizedName}.pdf`}`;

  // If already downloaded and valid
  const fileInfo = await FileSystem.getInfoAsync(localPath);
  if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
    return localPath;
  }

  if (fileUrl.startsWith('file://')) {
    // Local file, copy if different path
    if (fileUrl !== localPath) {
      await FileSystem.copyAsync({ from: fileUrl, to: localPath });
    }
    return localPath;
  }

  const resolvedUrl = resolveDownloadUrl(fileUrl);
  const token = await storage.getToken();

  const downloadHeaders: Record<string, string> = {
    Accept: 'application/pdf',
  };
  if (token) {
    downloadHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Download remote file
  const downloadResumable = FileSystem.createDownloadResumable(
    resolvedUrl,
    localPath,
    { headers: downloadHeaders },
    (downloadProgress) => {
      if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress(progress);
      }
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('Download failed: No file data received from server.');
  }

  // Strict verification: verify downloaded file is non-empty
  const verifiedInfo = await FileSystem.getInfoAsync(result.uri);
  if (!verifiedInfo.exists || !verifiedInfo.size || verifiedInfo.size === 0) {
    // Remove corrupt/empty file if exists
    try {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
    } catch {}
    throw new Error('Downloaded document is empty or unavailable.');
  }

  return result.uri;
}

/**
 * Checks if a specific PDF is already saved offline.
 */
export async function isPdfSavedLocally(fileName: string): Promise<boolean> {
  try {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localPath = `${FileSystem.documentDirectory}studyhub_notes/${sanitizedName.endsWith('.pdf') ? sanitizedName : `${sanitizedName}.pdf`}`;
    const info = await FileSystem.getInfoAsync(localPath);
    return Boolean(info.exists && info.size && info.size > 0);
  } catch {
    return false;
  }
}

/**
 * Shares a PDF file natively using Android / iOS native share sheet.
 */
export async function sharePdfFile(fileUrl: string, fileName: string, title?: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Sharing Unavailable', 'Native sharing is not supported on this device.');
    return;
  }

  // Ensure file is locally saved first
  const localUri = await downloadPdfFile(fileUrl, fileName);
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: title || `Share ${fileName}`,
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Downloads a single image to the device's local cache / document directory.
 * Fails safely if unreachable; never writes fake image files.
 */
export async function downloadImageFile(
  imageUrl: string,
  imageName: string
): Promise<string> {
  const sanitizedName = imageName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const localDir = `${FileSystem.documentDirectory}studyhub_images/`;

  const dirInfo = await FileSystem.getInfoAsync(localDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(localDir, { intermediates: true });
  }

  const localPath = `${localDir}${sanitizedName.endsWith('.jpg') || sanitizedName.endsWith('.png') ? sanitizedName : `${sanitizedName}.jpg`}`;

  if (imageUrl.startsWith('file://')) {
    if (imageUrl !== localPath) {
      await FileSystem.copyAsync({ from: imageUrl, to: localPath });
    }
    return localPath;
  }

  const resolvedUrl = resolveDownloadUrl(imageUrl);
  const token = await storage.getToken();

  const downloadHeaders: Record<string, string> = {};
  if (token) {
    downloadHeaders['Authorization'] = `Bearer ${token}`;
  }

  const downloadRes = await FileSystem.downloadAsync(resolvedUrl, localPath, {
    headers: downloadHeaders,
  });

  if (!downloadRes || !downloadRes.uri) {
    throw new Error('Image download failed: Empty response.');
  }

  const verifiedInfo = await FileSystem.getInfoAsync(downloadRes.uri);
  if (!verifiedInfo.exists || !verifiedInfo.size || verifiedInfo.size === 0) {
    try {
      await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
    } catch {}
    throw new Error('Downloaded image is empty or invalid.');
  }

  return downloadRes.uri;
}

/**
 * Shares an image natively.
 */
export async function shareImageFile(imageUrl: string, imageName: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Sharing Unavailable', 'Native sharing is not supported on this device.');
    return;
  }

  const localUri = await downloadImageFile(imageUrl, imageName);
  await Sharing.shareAsync(localUri, {
    mimeType: 'image/jpeg',
    dialogTitle: `Share ${imageName}`,
  });
}
