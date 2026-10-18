import React from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StudyHubProvider } from '@/store/StudyHubContext';
import { THEME } from '@/constants/theme';

LogBox.ignoreLogs([
  "Response.blob() is using React Native's Blob",
]);

export default function RootLayout() {
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
      </StudyHubProvider>
    </SafeAreaProvider>
  );
}
