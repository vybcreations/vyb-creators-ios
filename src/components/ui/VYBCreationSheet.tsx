import React from 'react';
import { View, Pressable } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { DraggableSheet, SheetHeader } from '../DraggableSheet';
import { colors as C } from '../../theme';

/**
 * VYBCreationSheet — the new VYB v2 source-of-truth for creation/editing
 * flows (Add Book, Reading Session, future Add Habit, Edit Area, etc.).
 *
 * Internally wraps DraggableSheet with the configuration we want for
 * every creation flow:
 *   - keyboardAvoiding=false  → sheet stays fixed, content handles
 *                                keyboard via inner ScrollView's
 *                                automaticallyAdjustKeyboardInsets
 *   - maxHeightFraction=0.95  → renders at true 95% (with the new
 *                                fillSheet behavior of DraggableSheet),
 *                                not content-driven
 *   - showClose=false         → header owns the close button
 *   - iPad max-width + centered  (inherited from DraggableSheet)
 *
 * Children should be a flex:1 body. Typically:
 *   <VYBCreationSheet visible={...} onDismiss={...} title="Add a book">
 *     <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 20 }}>
 *       ...form / scrollview...
 *     </View>
 *   </VYBCreationSheet>
 *
 * For multi-step flows, pass `onBack` so a back arrow appears next to the
 * title (e.g. Search → Preview in Add Book).
 */
export function VYBCreationSheet({
  visible, onDismiss, title, onBack, children,
  maxHeightFraction = 0.95,
}: {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  /** When provided, a left-aligned back arrow renders next to the title. */
  onBack?: () => void;
  children: React.ReactNode;
  /** Override the default 0.95 (only do this if you really want a shorter
   *  sheet — most creation flows should use the full-height default). */
  maxHeightFraction?: number;
}) {
  return (
    <DraggableSheet
      visible={visible}
      onDismiss={onDismiss}
      showClose={false}
      keyboardAvoiding={false}
      maxHeightFraction={maxHeightFraction}
      surface="glass"
    >
      <SheetHeader
        title={title}
        onClose={onDismiss}
        leftAccessory={onBack ? (
          <Pressable onPress={onBack} hitSlop={10}>
            <ArrowLeft size={20} color={C.textPrimary} />
          </Pressable>
        ) : undefined}
      />
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </DraggableSheet>
  );
}
