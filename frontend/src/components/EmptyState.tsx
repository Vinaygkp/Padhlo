import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../constants/theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionTitle,
  onAction,
}) => {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.iconWrapper}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="purple"
          size="sm"
          style={styles.button}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  button: {
    minWidth: 140,
  },
});
