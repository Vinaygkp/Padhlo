import * as Updates from 'expo-updates';

/**
 * Service to manage Expo EAS Updates (Over-The-Air JavaScript & Asset Updates)
 * 
 * Safety Principles:
 * 1. Only checks in production release builds where Updates are enabled.
 * 2. Fetches compatible updates silently in the background.
 * 3. Never forces an abrupt reload while the user is typing, entering an OTP,
 *    or interacting with the app.
 * 4. The fetched update will naturally and safely take effect on the next app restart.
 * 5. Handles network failures and offline mode completely silently.
 */
export async function checkAndFetchEasUpdate(): Promise<void> {
  // Do not run in development mode or Expo Go
  if (__DEV__ || !Updates.isEnabled) {
    return;
  }

  try {
    const updateCheck = await Updates.checkForUpdateAsync();

    if (updateCheck.isAvailable) {
      console.log('📦 New compatible EAS Update detected. Fetching in background...');
      const fetchResult = await Updates.fetchUpdateAsync();
      
      if (fetchResult.isNew) {
        console.log('✅ EAS Update downloaded successfully. Will apply automatically on next app launch.');
      }
    }
  } catch (error: any) {
    // Silently log warning. Never disrupt the user or throw uncaught errors.
    console.warn('ℹ️ EAS Update check skipped or network unavailable:', error?.message || 'offline');
  }
}
