import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { DraggableSheet } from './DraggableSheet';
import { colors as C, fonts as F, radius as R } from '../theme';

export type ActionMenuOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: React.ReactNode;
};

export function ActionMenu({
  visible, onDismiss, title, options,
}: {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  options: ActionMenuOption[];
}) {
  return (
    <DraggableSheet visible={visible} onDismiss={onDismiss} maxHeightFraction={0.6}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        {title && (
          <Text style={{
            fontFamily: F.sansBold, fontSize: 11, color: C.textMuted,
            letterSpacing: 2, textTransform: 'uppercase',
            textAlign: 'center', marginBottom: 12,
          }}>
            {title}
          </Text>
        )}
        <View style={{ backgroundColor: C.bgOverlay, borderRadius: R.lg, borderColor: C.borderSubtle, borderWidth: 1, overflow: 'hidden' }}>
          {options.map((opt, i) => (
            <Pressable
              key={opt.label}
              onPress={() => { onDismiss(); setTimeout(opt.onPress, 100); }}
              style={({ pressed }) => ({
                paddingVertical: 16, paddingHorizontal: 18,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderBottomColor: C.borderSubtle, borderBottomWidth: i < options.length - 1 ? 1 : 0,
                backgroundColor: pressed ? 'rgba(201,169,97,0.08)' : 'transparent',
              })}>
              {opt.icon}
              <Text style={{
                flex: 1,
                fontFamily: F.sansBold, fontSize: 15,
                color: opt.destructive ? C.clay : C.textPrimary,
                letterSpacing: -0.1,
              }}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => ({
            marginTop: 10, paddingVertical: 16,
            backgroundColor: pressed ? C.bgOverlay : C.bgElevated,
            borderRadius: R.lg, borderColor: C.borderMid, borderWidth: 1,
            alignItems: 'center',
          })}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 15, color: C.textSecondary, letterSpacing: -0.1 }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </DraggableSheet>
  );
}
