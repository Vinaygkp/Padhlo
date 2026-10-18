import React from 'react';
import { View, Text, TextInput, StyleSheet, TextStyle, ViewStyle, TouchableOpacity } from 'react-native';
import { THEME } from '../constants/theme';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  error?: string;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  maxLength,
  error,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  editable = true,
  autoCapitalize,
  autoCorrect,
}) => {
  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputContainer,
          error ? styles.inputError : null,
          multiline ? { minHeight: 90, alignItems: 'flex-start' } : null,
        ]}
      >
        <TextInput
          style={[
            styles.input,
            multiline ? styles.multilineInput : null,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={THEME.textTertiary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          editable={editable}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
        />
        {rightIcon ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onRightIconPress}
            style={styles.rightIcon}
          >
            {rightIcon}
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1.2,
    borderColor: THEME.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  inputError: {
    borderColor: THEME.red,
  },
  input: {
    flex: 1,
    height: 48,
    color: THEME.textPrimary,
    fontSize: 15,
    paddingVertical: 0,
  },
  multilineInput: {
    minHeight: 84,
    height: undefined,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },
  rightIcon: {
    marginLeft: 8,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: THEME.red,
    fontSize: 12,
    marginTop: 5,
    fontWeight: '600',
  },
});
