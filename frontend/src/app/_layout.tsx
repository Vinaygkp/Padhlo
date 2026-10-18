import React, { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StudyHubProvider } from '@/store/StudyHubContext';
import { THEME } from '@/constants/theme';
import { checkAndFetchEasUpdate } from '@/services/updateService';
import { checkAppUpdateStatus, AppVersionManifest } from '@/services/appVersionService';
import { UpdateNoticeModal } from '@/components/UpdateNoticeModal';

LogBox.ignoreLogs([
  "Response.blob() is using React Native's Blob",
]);

export default function RootLayout() {
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateManifest, setUpdateManifest] = useState<AppVersionManifest | null>(null);
  const [isUpdateMandatory, setIsUpdateMandatory] = useState(false);
  const [currentAppVersion, setCurrentAppVersion] = useState('1.0.0');

  useEffect(() => {
    // 1. Check & background-fetch compatible EAS OTA updates (release builds only)
    checkAndFetchEasUpdate();

    // 2. Check for native APK updates from backend manifest
    checkAppUpdateStatus()
      .then((result) => {
        if (result.isUpdateAvailable && result.manifest) {
          setUpdateManifest(result.manifest);
          setIsUpdateMandatory(result.isMandatory);
          setCurrentAppVersion(result.currentVersion);
          setUpdateModalVisible(true);
        }
      })
      .catch((err) => {
        // Silently catch errors so app launch is never disrupted
        console.warn('Update status check skipped:', err?.message || 'offline');
      });
  }, []);

  return (
    <SafeAreaProvider>
      <StudyHubProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: THEME.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="admin/dashboard" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin/upload-notes" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin/upload-short-notes" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin/manage-exams" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin/manage-syllabus" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin/announcements" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin/analytics" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin/notes-importer" options={{ presentation: 'card' }} />
          <Stack.Screen name="pdf-viewer" options={{ presentation: 'modal' }} />
          <Stack.Screen name="bookmarks" options={{ presentation: 'card' }} />
          <Stack.Screen name="downloads" options={{ presentation: 'card' }} />
          <Stack.Screen name="announcements-feed" options={{ presentation: 'card' }} />
        </Stack>

        {/* In-App APK Update Notice Modal */}
        <UpdateNoticeModal
          visible={updateModalVisible}
          manifest={updateManifest}
          currentVersion={currentAppVersion}
          isMandatory={isUpdateMandatory}
          onDismiss={() => setUpdateModalVisible(false)}
        />
      </StudyHubProvider>
    </SafeAreaProvider>
  );
}
