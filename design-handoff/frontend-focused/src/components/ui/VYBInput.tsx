import React from 'react';
import {
  View, Text, TextInput, TextInputProps, StyleProp, ViewStyle, TextStyle,
} from 'react-native';
import { colors as C, fonts as F } from '../../theme';

/**
 * VYBInput — base text input.
 *
 * Replaces the inline TextInput styles repeated across composers/forms
 * (Tasks composer body, Capture, Challenge/Circle modals, EditProfile, etc.).
 *
 * Premium dark rounded surface; multiline grows in place. Leading icon
 * optional. Error state shows a coral border + helper line.
 */

export type VYBInputProps = Omit<TextInputProps, 'style'> & {
  icon?: React.ReactNode;
  error?: string;
  multiline?: boolean;
  inputStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export const VYBInput = React.forwardRef<TextInput, VYBInputProps>(function VYBInput({
  icon, error, multiline, inputStyle, containerStyle,
  placeholderTextColor = C.textFaint,
  ...textInputProps
}, ref) {
  const borderColor = error ? 'rgba(210,112,80,0.55)' : C.borderSubtle;
  return (
    <View>
      <View style={[{
        flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 10,
        paddingHorizontal: 14,
        paddingVertical: multiline ? 12 : 0,
        minHeight: multiline ? 60 : 44,
        borderRadius: 14,
        backgroundColor: C.bgOverlay, borderColor, borderWidth: 1,
      }, containerStyle]}>
        {icon}
        <TextInput
          ref={ref}
          {...textInputProps}
          multiline={multiline}
          placeholderTextColor={placeholderTextColor}
          style={[{
            flex: 1, color: C.textPrimary,
            fontFamily: F.sans, fontSize: 14,
            paddingVertical: multiline ? 0 : 12,
          }, inputStyle]}
        />
      </View>
      {error ? (
        <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: '#D27050', marginTop: 6, marginLeft: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});
