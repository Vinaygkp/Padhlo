import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle 
} from 'react-native';
import { THEME } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'purple' | 'blue' | 'pink' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'purple',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={THEME.white} size="small" />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text
            style={[
              styles.text,
              styles[`text_${variant}`],
              styles[`textSize_${size}`],
              icon ? { marginLeft: 8 } : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  purple: {
    backgroundColor: THEME.purple,
    shadowColor: THEME.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  blue: {
    backgroundColor: THEME.blue,
    shadowColor: THEME.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  pink: {
    backgroundColor: THEME.pink,
    shadowColor: THEME.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  outline: {
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1.5,
    borderColor: THEME.surfaceBorder,
  },
  danger: {
    backgroundColor: THEME.red,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  size_sm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  size_md: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  size_lg: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  text_purple: {
    color: THEME.white,
  },
  text_blue: {
    color: THEME.black,
  },
  text_pink: {
    color: THEME.white,
  },
  text_outline: {
    color: THEME.textPrimary,
  },
  text_danger: {
    color: THEME.white,
  },
  text_ghost: {
    color: THEME.textSecondary,
  },
  textSize_sm: {
    fontSize: 13,
  },
  textSize_md: {
    fontSize: 15,
  },
  textSize_lg: {
    fontSize: 16,
  },
});
