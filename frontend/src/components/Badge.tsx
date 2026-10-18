import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'purple' | 'blue' | 'pink' | 'cyan' | 'green' | 'gold' | 'red' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'purple', size = 'sm' }) => {
  return (
    <View style={[styles.badge, styles[variant], styles[`size_${size}`]]}>
      <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`]]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  purple: {
    backgroundColor: THEME.purpleMuted,
    borderColor: THEME.purple + '50',
  },
  blue: {
    backgroundColor: THEME.blueMuted,
    borderColor: THEME.blue + '50',
  },
  pink: {
    backgroundColor: THEME.pinkMuted,
    borderColor: THEME.pink + '50',
  },
  cyan: {
    backgroundColor: THEME.cyanMuted,
    borderColor: THEME.cyan + '50',
  },
  green: {
    backgroundColor: THEME.greenMuted,
    borderColor: THEME.green + '50',
  },
  gold: {
    backgroundColor: THEME.goldMuted,
    borderColor: THEME.gold + '50',
  },
  red: {
    backgroundColor: THEME.redMuted,
    borderColor: THEME.red + '50',
  },
  neutral: {
    backgroundColor: THEME.surfaceElevated,
    borderColor: THEME.surfaceBorder,
  },
  size_sm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  size_md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  text_purple: { color: THEME.purple },
  text_blue: { color: THEME.blue },
  text_pink: { color: THEME.pink },
  text_cyan: { color: THEME.cyan },
  text_green: { color: THEME.green },
  text_gold: { color: THEME.gold },
  text_red: { color: THEME.red },
  text_neutral: { color: THEME.textSecondary },
  textSize_sm: { fontSize: 11 },
  textSize_md: { fontSize: 12 },
});
