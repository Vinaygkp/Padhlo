import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Helper to check if a URL points to localhost or private LAN IP
 */
const isLocalOrPrivateIp = (url: string): boolean => {
  const clean = url.toLowerCase();
  return (
    clean.includes('localhost') ||
    clean.includes('127.0.0.1') ||
    clean.includes('10.0.2.2') ||
    clean.includes('192.168.') ||
    clean.includes('.local') ||
    /https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(clean) ||
    /https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/.test(clean)
  );
};

/**
 * Dynamically resolves the backend API Base URL:
 * - In Production release builds (!__DEV__):
 *   STRICTLY REQUIRES a valid public HTTPS EXPO_PUBLIC_API_URL.
 *   Never silently falls back to localhost or LAN IPs.
 * - In Development (__DEV__):
 *   Uses EXPO_PUBLIC_API_URL if configured, otherwise falls back to Metro host or local LAN IP.
 */
export const getApiBaseUrl = (): string => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const isProduction = !__DEV__ || process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!configuredUrl) {
      throw new Error(
        'FATAL: Production build requires EXPO_PUBLIC_API_URL to be set to a valid public HTTPS backend URL.'
      );
    }

    if (isLocalOrPrivateIp(configuredUrl)) {
      throw new Error(
        `FATAL: Production build cannot point to a local/LAN IP (${configuredUrl}). Configure a public HTTPS backend URL.`
      );
    }

    if (!configuredUrl.startsWith('https://')) {
      throw new Error(
        `FATAL: Production EXPO_PUBLIC_API_URL must use HTTPS protocol for secure student data transmission: ${configuredUrl}`
      );
    }

    return configuredUrl.replace(/\/+$/, '');
  }

  // --- Development Mode (__DEV__ === true) ---
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  const hostUri = 
    Constants.expoConfig?.hostUri || 
    (Constants as any)?.manifest?.debuggerHost || 
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:5000`;
    }
  }

  // Default LAN IP fallback for mobile devices on same Wi-Fi in development only
  const LAN_IP = '192.168.1.110';

  if (Platform.OS === 'android') {
    return `http://${LAN_IP}:5000`;
  }

  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();
