import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { ThemeColors } from '../../theme/tokens';
import { fontSizes, fontWeights, spacing } from '../../theme/tokens';

export type InputProps = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  colors: ThemeColors;
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  multiline,
  numberOfLines,
  autoCapitalize = 'none',
  keyboardType,
  colors,
}: InputProps) {
  const hasError = Boolean(error);
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.bgElevated,
            borderColor: hasError ? colors.error : colors.border,
          },
          multiline && styles.multiline,
        ]}
      />
      {hasError ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    marginBottom: spacing[2],
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSizes.base,
    minHeight: 44,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: fontSizes.xs,
    marginTop: spacing[1],
  },
});
