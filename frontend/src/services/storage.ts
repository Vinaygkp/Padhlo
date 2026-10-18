import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const TOKEN_KEY = 'campusos_auth_token';
const USER_KEY = 'campusos_current_user';
const ONBOARDING_KEY = 'campusos_onboarding_completed';
const THEME_KEY = 'campusos_theme_mode';

export const storage = {
  // Sensitive tokens in SecureStore (fallback to AsyncStorage in dev web if ever accessed)
  async saveToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    }
  },

  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return await AsyncStorage.getItem(TOKEN_KEY);
    }
  },

  async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  },

  // User Profile
  async saveUser(user: User): Promise<void> {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  async getUser(): Promise<User | null> {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(USER_KEY);
  },

  // Onboarding
  async setOnboardingCompleted(completed: boolean): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_KEY, completed ? 'true' : 'false');
  },

  async isOnboardingCompleted(): Promise<boolean> {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val === 'true';
  },

  // Theme
  async saveTheme(theme: 'dark' | 'light'): Promise<void> {
    await AsyncStorage.setItem(THEME_KEY, theme);
  },

  async getTheme(): Promise<'dark' | 'light'> {
    const val = await AsyncStorage.getItem(THEME_KEY);
    return val === 'light' ? 'light' : 'dark';
  },

  // Generic key-value store for offline persistence
  async saveItem<T>(key: string, data: T): Promise<void> {
    await AsyncStorage.setItem(`campusos_${key}`, JSON.stringify(data));
  },

  async getItem<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(`campusos_${key}`);
    return raw ? JSON.parse(raw) : null;
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(`campusos_${key}`);
  },

  async clearAll(): Promise<void> {
    await storage.removeToken();
    await storage.removeUser();
    await AsyncStorage.clear();
  }
};
