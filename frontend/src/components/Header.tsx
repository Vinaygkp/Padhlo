import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { THEME } from '../constants/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
  onTitlePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, badge, rightAction, style, onTitlePress }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleWrapper}>
        <View style={styles.titleRow}>
          {onTitlePress ? (
            <TouchableOpacity onPress={onTitlePress} activeOpacity={0.7}>
              <Text style={styles.title}>{title}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.title}>{title}</Text>
          )}
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          onTitlePress ? (
            <TouchableOpacity onPress={onTitlePress} activeOpacity={0.7}>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )
        ) : null}
      </View>
      {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  titleWrapper: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: -0.6,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: THEME.purpleMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.purple + '50',
  },
  badgeText: {
    fontSize: 11,
    color: THEME.purple,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginTop: 3,
    fontWeight: '500',
  },
  rightAction: {
    marginLeft: 12,
  },
});
