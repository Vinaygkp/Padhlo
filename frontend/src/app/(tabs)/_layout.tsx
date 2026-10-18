import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, FileText, Sparkles, CalendarCheck2, User } from 'lucide-react-native';
import { THEME } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.purple,
        tabBarInactiveTintColor: THEME.textTertiary,
        tabBarStyle: {
          backgroundColor: THEME.surfaceCard,
          borderTopColor: THEME.surfaceBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ color, size }) => <FileText size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'Vinay AI',
          tabBarIcon: ({ color, size }) => <Sparkles size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: 'Exams',
          tabBarIcon: ({ color, size }) => <CalendarCheck2 size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="syllabus"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
