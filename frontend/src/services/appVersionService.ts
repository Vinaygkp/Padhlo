import Constants from 'expo-constants';
import { API_BASE_URL } from '@/constants/api';

export interface AppVersionManifest {
  latestVersion: string;
  minimumSupportedVersion: string;
  apkUrl: string;
  releaseNotes?: string;
  updateRequired?: boolean;
}

export interface AppUpdateCheckResult {
  isUpdateAvailable: boolean;
  isMandatory: boolean;
  currentVersion: string;
  manifest: AppVersionManifest | null;
}

/**
 * Compares two semantic version strings (e.g. "1.0.0" vs "1.0.1")
 * Returns true if current is older than target
 */
export function isVersionOlder(currentVersion: string, targetVersion: string): boolean {
  if (!currentVersion || !targetVersion) return false;

  const sanitize = (v: string) => v.replace(/^v/, '').trim();
  const currentParts = sanitize(currentVersion).split('.').map((p) => parseInt(p, 10) || 0);
  const targetParts = sanitize(targetVersion).split('.').map((p) => parseInt(p, 10) || 0);

  const length = Math.max(currentParts.length, targetParts.length);
  for (let i = 0; i < length; i++) {
    const cur = currentParts[i] || 0;
    const tgt = targetParts[i] || 0;
    if (cur < tgt) return true;
    if (cur > tgt) return false;
  }

  return false;
}

/**
 * Fetches the remotely configured version/update manifest from the backend
 */
export async function fetchAppVersionManifest(): Promise<AppVersionManifest | null> {
  try {
    const endpoint = `${API_BASE_URL}/api/app/version`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Version check returned status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || !data.latestVersion || !data.apkUrl) {
      return null;
    }

    return {
      latestVersion: String(data.latestVersion).trim(),
      minimumSupportedVersion: String(data.minimumSupportedVersion || data.latestVersion).trim(),
      apkUrl: String(data.apkUrl).trim(),
      releaseNotes: data.releaseNotes ? String(data.releaseNotes).trim() : undefined,
      updateRequired: Boolean(data.updateRequired),
    };
  } catch {
    // Offline or network error; handle gracefully without interrupting app flow
    return null;
  }
}

/**
 * Checks if a new native APK update is available for this device
 */
export async function checkAppUpdateStatus(): Promise<AppUpdateCheckResult> {
  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const manifest = await fetchAppVersionManifest();

  if (!manifest) {
    return {
      isUpdateAvailable: false,
      isMandatory: false,
      currentVersion,
      manifest: null,
    };
  }

  const isNewerVersionAvailable = isVersionOlder(currentVersion, manifest.latestVersion);
  const isBelowMinimumSupported = isVersionOlder(currentVersion, manifest.minimumSupportedVersion);
  const isMandatory = isBelowMinimumSupported || Boolean(manifest.updateRequired);

  return {
    isUpdateAvailable: isNewerVersionAvailable || isMandatory,
    isMandatory,
    currentVersion,
    manifest,
  };
}
