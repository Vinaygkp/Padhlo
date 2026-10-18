import { Platform, Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { storage } from './storage';
import { API_BASE_URL } from '@/constants/api';

const CACHE_DIR = `${FileSystem.cacheDirectory}pdf_viewer_cache/`;
const OFFLINE_DIR = `${FileSystem.documentDirectory}studyhub_notes/`;

/**
 * Sanitizes a filename to ensure Android file system and intent compatibility
 */
export function sanitizePdfFileName(fileName: string): string {
  const clean = (fileName || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean.endsWith('.pdf') ? clean : `${clean}.pdf`;
}

/**
 * Ensures the temporary PDF viewer cache directory exists in app-managed storage
 */
async function ensureCacheDirExists(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

/**
 * Resolves a local or remote URL into an absolute downloadable endpoint,
 * handling Android emulator and physical device localhost mappings where appropriate.
 */
export function resolveDownloadUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('file://') || url.startsWith('content://')) {
    return url;
  }

  let resolved = url;
  // If URL is a relative backend path
  if (resolved.startsWith('/')) {
    resolved = `${API_BASE_URL}${resolved}`;
  }

  // If localhost is accessed from an Android device, redirect to API_BASE_URL
  if (Platform.OS === 'android' && resolved.includes('localhost:5000')) {
    resolved = resolved.replace('http://localhost:5000', API_BASE_URL);
  }

  return resolved;
}

export interface OpenPdfOptions {
  fileUrl: string;
  fileName: string;
  title?: string;
  onProgress?: (progress: number) => void;
  showDriveNotice?: boolean;
}

/**
 * Downloads the authorized PDF into app-managed temporary cache and opens it in an
 * external Android PDF viewer using Android's secure FileProvider content URI.
 *
 * Requirements satisfied:
 * - Opens in an external Android PDF viewer instead of internal reader.
 * - Does not force Google Drive; allows compatible installed viewers to handle the intent.
 * - Explains Google Drive behavior if Drive is the sole viewer.
 * - Uses secure FileProvider content URI with temporary read permission flag.
 * - Keeps offline downloads and cloud originals completely separate and safe.
 */
export async function openPdfInExternalViewer({
  fileUrl,
  fileName,
  title,
  onProgress,
  showDriveNotice = false,
}: OpenPdfOptions): Promise<boolean> {
  try {
    if (!fileUrl) {
      throw new Error('No PDF URL or document source was provided.');
    }

    await ensureCacheDirExists();
    const sanitizedName = sanitizePdfFileName(fileName || title || 'document.pdf');
    const targetCachePath = `${CACHE_DIR}${sanitizedName}`;

    let localFilePath = '';

    // 1. Check if the file is already downloaded offline in persistent user storage
    const offlinePath = `${OFFLINE_DIR}${sanitizedName}`;
    const offlineInfo = await FileSystem.getInfoAsync(offlinePath);
    if (offlineInfo.exists && offlineInfo.size && offlineInfo.size > 0) {
      localFilePath = offlinePath;
    } else if (fileUrl.startsWith('file://') || fileUrl.startsWith('content://')) {
      // Local file reference (e.g. DocumentPicker or app cache)
      try {
        if (fileUrl !== targetCachePath) {
          await FileSystem.copyAsync({ from: fileUrl, to: targetCachePath });
          localFilePath = targetCachePath;
        } else {
          localFilePath = fileUrl;
        }
      } catch {
        // Fallback for DocumentPicker scoped cache restriction in Expo Go:
        // Use native fetch blob -> base64 -> write to targetCachePath
        try {
          const resp = await fetch(fileUrl);
          const blob = await resp.blob();
          const reader = new FileReader();
          const b64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const res = (reader.result as string) || '';
              const parts = res.split(',');
              resolve(parts[1] || res);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(blob);
          const b64 = await b64Promise;
          if (b64) {
            await FileSystem.writeAsStringAsync(targetCachePath, b64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            localFilePath = targetCachePath;
          }
        } catch (fetchErr) {
          console.warn('Fallback fetch copy failed for local uri:', fetchErr);
          localFilePath = fileUrl;
        }
      }
    }

    // 2. If not already local, download securely to app-managed temporary cache
    if (!localFilePath) {
      const resolvedUrl = resolveDownloadUrl(fileUrl);
      const token = await storage.getToken();

      const downloadHeaders: Record<string, string> = {
        Accept: 'application/pdf',
      };
      if (token) {
        downloadHeaders['Authorization'] = `Bearer ${token}`;
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        resolvedUrl,
        targetCachePath,
        { headers: downloadHeaders },
        (downloadProgress) => {
          if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            onProgress(progress);
          }
        }
      );

      const downloadResult = await downloadResumable.downloadAsync();
      if (!downloadResult || !downloadResult.uri) {
        throw new Error('Download failed: The server did not return a valid file.');
      }

      // Verify the downloaded file is valid and non-empty
      const downloadedInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (!downloadedInfo.exists || !downloadedInfo.size || downloadedInfo.size === 0) {
        throw new Error('The downloaded PDF file is empty or corrupted.');
      }

      localFilePath = downloadResult.uri;
    }

    // 3. Platform-specific external viewer launch
    if (Platform.OS === 'android') {
      try {
        let contentUri = localFilePath;
        if (localFilePath.startsWith('file://')) {
          try {
            contentUri = await FileSystem.getContentUriAsync(localFilePath);
          } catch {
            contentUri = localFilePath;
          }
        }

        const launchViewer = async () => {
          // If we have a genuine content:// URI, attempt Android VIEW intent
          if (contentUri.startsWith('content://')) {
            try {
              await launchAndroidPdfIntent(contentUri);
              return;
            } catch (intentErr: any) {
              console.warn('launchAndroidPdfIntent notice, falling back to Sharing:', intentErr?.message);
            }
          }

          // Rock-solid fallback using Sharing.shareAsync (handles FileProvider permissions natively)
          const isShareAvailable = await Sharing.isAvailableAsync();
          if (isShareAvailable) {
            await Sharing.shareAsync(localFilePath, {
              mimeType: 'application/pdf',
              dialogTitle: title || fileName,
            });
            return;
          }

          throw new Error('No PDF viewer available to open this document.');
        };

        // Open in Google Drive / external viewer dialog
        if (showDriveNotice) {
          Alert.alert(
            'Open in Google Drive / PDF App',
            'Padhlo will open this document in your preferred viewer (Google Drive, Adobe Acrobat, WPS Office, or your device default PDF app).',
            [
              {
                text: 'Open PDF',
                onPress: async () => {
                  try {
                    await launchViewer();
                  } catch (err: any) {
                    handleIntentError(err);
                  }
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return true;
        }

        await launchViewer();
        return true;
      } catch (intentErr: any) {
        handleIntentError(intentErr);
        return false;
      }
    } else if (Platform.OS === 'ios') {
      // iOS native preview sheet / share sheet
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(localFilePath, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: title || fileName,
        });
        return true;
      } else {
        await Linking.openURL(localFilePath);
        return true;
      }
    } else {
      // Web / fallback
      await Linking.openURL(fileUrl);
      return true;
    }
  } catch (err: any) {
    console.error('Error opening PDF externally:', err);
    handleGeneralError(err);
    return false;
  }
}

/**
 * Fires the Android VIEW intent with FileProvider content URI and temporary read permission flag.
 * Does not set any hardcoded package name, allowing Android's system resolver to select
 * from all compatible installed PDF viewers.
 */
async function launchAndroidPdfIntent(contentUri: string): Promise<void> {
  // CRITICAL: NEVER pass raw file:// URI to Intent.setData() on Android 7+ (FileUriExposedException)
  if (!contentUri.startsWith('content://')) {
    throw new Error('Requires content:// URI for Android intent');
  }
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/pdf',
    flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
  });
}

/**
 * Handles intent launch failures (such as no PDF viewer app installed).
 */
function handleIntentError(error: any): void {
  const message = error?.message || '';

  if (
    message.includes('No Activity found') ||
    message.includes('ActivityNotFoundException') ||
    message.includes('cannot handle intent')
  ) {
    Alert.alert(
      'No PDF Viewer App Installed',
      'No compatible PDF viewer was found on your Android device.\n\nPlease install a PDF viewer (such as Adobe Acrobat Reader, Google PDF Viewer, or WPS Office) from the Google Play Store to view your study notes.',
      [
        {
          text: 'Install PDF Viewer',
          onPress: () => {
            Linking.openURL('https://play.google.com/store/search?q=pdf%20reader&c=apps');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  } else {
    Alert.alert('Unable to Open PDF', message || 'Android could not find a viewer to handle this PDF document.');
  }
}

/**
 * Handles general download, network, or authorization errors.
 */
function handleGeneralError(error: any): void {
  const msg = error?.message || '';

  if (msg.includes('403') || msg.includes('Access restricted') || msg.includes('Not authorized')) {
    Alert.alert(
      'Access Restricted',
      'This study material is restricted to specific academic branches or years. Please contact your college administrator if you need access.'
    );
  } else if (msg.includes('401') || msg.includes('unauthorized')) {
    Alert.alert('Session Expired', 'Please sign in again to access this study note.');
  } else if (msg.includes('Network') || msg.includes('ENOTFOUND') || msg.includes('timed out')) {
    Alert.alert('Network Connection Error', 'Unable to reach the server. Please check your internet connection.');
  } else {
    Alert.alert('Could Not Open PDF', msg || 'An unexpected error occurred while preparing the PDF for viewing.');
  }
}

/**
 * Safely clears temporary cache files without touching offline downloads or cloud originals.
 */
export async function clearTemporaryPdfCache(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await ensureCacheDirExists();
    }
  } catch (err) {
    console.warn('Temporary PDF cache cleanup notice:', err);
  }
}

/**
 * Computes the total byte size of temporary cached PDFs.
 */
export async function getTemporaryPdfCacheSize(): Promise<number> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) return 0;

    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    let totalBytes = 0;
    for (const f of files) {
      const info = await FileSystem.getInfoAsync(`${CACHE_DIR}${f}`);
      if (info.exists && info.size) {
        totalBytes += info.size;
      }
    }
    return totalBytes;
  } catch {
    return 0;
  }
}
