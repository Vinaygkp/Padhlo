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

// In-session cache to prevent redundant network requests and popup flickering
let cachedCheckResult: AppUpdateCheckResult | null = null;
let lastCheckTimestamp = 0;
const CHECK_COOLDOWN_MS = 60 * 1000; // 1-minute cooldown between network checks

/**
 * Fetches the remotely configured version/update manifest from the backend
 */
export async function fetchAppVersionManifest(): Promise<AppVersionManifest | null> {
  try {
    const endpoint = `${API_BASE_URL}/api/app-update`;
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
      console.warn(`App update check returned status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || data.success === false || !data.latestVersion || !data.apkUrl) {
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
 * Checks if a new native APK update is available for this device.
 * Respects in-session caching to prevent repeated network requests on tab/screen switches.
 */
export async function checkAppUpdateStatus(forceRefresh = false): Promise<AppUpdateCheckResult> {
  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  if (!forceRefresh && cachedCheckResult && Date.now() - lastCheckTimestamp < CHECK_COOLDOWN_MS) {
    return cachedCheckResult;
  }

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

  // If installed version is already current and not below minimum supported version, do not show update modal
  if (!isNewerVersionAvailable && !isBelowMinimumSupported) {
    const currentResult: AppUpdateCheckResult = {
      isUpdateAvailable: false,
      isMandatory: false,
      currentVersion,
      manifest,
    };
    cachedCheckResult = currentResult;
    lastCheckTimestamp = Date.now();
    return currentResult;
  }

  // Mandatory check:
  // If APP_UPDATE_REQUIRED=true and installed is below APP_MIN_SUPPORTED_VERSION, OR if installed is below minimum supported version
  const isMandatory = isBelowMinimumSupported || (Boolean(manifest.updateRequired) && isNewerVersionAvailable);

  const result: AppUpdateCheckResult = {
    isUpdateAvailable: isNewerVersionAvailable || isMandatory,
    isMandatory,
    currentVersion,
    manifest,
  };

  cachedCheckResult = result;
  lastCheckTimestamp = Date.now();
  return result;
}
