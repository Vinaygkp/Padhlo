import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { THEME } from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'card' | 'elevated' | 'glowPurple' | 'glowBlue' | 'glowPink';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'card' }) => {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'glowPurple' && styles.glowPurple,
        variant === 'glowBlue' && styles.glowBlue,
        variant === 'glowPink' && styles.glowPink,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: THEME.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  elevated: {
    backgroundColor: THEME.surfaceElevated,
    borderColor: THEME.borderHighlight,
  },
  glowPurple: {
    backgroundColor: THEME.surfaceElevated,
    borderColor: THEME.purple,
    shadowColor: THEME.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  glowBlue: {
    backgroundColor: THEME.surfaceElevated,
    borderColor: THEME.blue,
    shadowColor: THEME.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  glowPink: {
    backgroundColor: THEME.surfaceElevated,
    borderColor: THEME.pink,
    shadowColor: THEME.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
});
