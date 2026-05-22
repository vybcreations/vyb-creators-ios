import React from 'react';
import { View, Pressable } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { DraggableSheet, SheetHeader } from '../DraggableSheet';
import { colors as C } from '../../theme';

/**
 * VYBCreationSheet — VYB v2 source of truth for sheet/modal flows.
 *
 * Variants drive height + keyboard strategy. Pick the variant that matches
 * the USER FLOW, not the visual ambition:
 *
 *   search   — Add Book, future "Add to circle", any search/discovery flow.
 *              Tall (88% screen) so results have room. Below safe-area top
 *              so Dynamic Island stays uncovered. Keyboard-safe via inner
 *              scroll (keyboardAvoiding=false).
 *
 *   action   — Reading Session, future contextual choice menus.
 *              Compact: content-sized, max 60%. Sits in the lower portion
 *              so the screen behind stays mostly visible. NOT for forms.
 *
 *   edit     — Edit Book, Edit Habit, Edit Area, Edit Profile sheet.
 *              Medium (75%). Enough room for form + actions; doesn't claim
 *              the whole screen for a quick edit.
 *
 *   creation — New Habit, New Area, future "Create challenge" sheet.
 *              Tall (88%) but framed as a form, not a search. Keyboard-safe
 *              via inner scroll.
 *
 *   compact  — Tiny menus / confirmations. Content-driven, max 45%.
 *
 *   full     — Reserved for immersive flows that truly need the whole
 *              screen. 95%, below safe area. Use sparingly.
 *
 * On iPad: every variant inherits DraggableSheet's tablet max-width
 * (560pt centered, 4-corner rounded). Tablet content doesn't stretch
 * full-width even for variant="search".
 *
 * Glass surface is on by default for every variant.
 */

export type VYBSheetVariant = 'search' | 'action' | 'edit' | 'creation' | 'compact' | 'full';

const VARIANT_CONFIG: Record<VYBSheetVariant, {
  /** Max fraction of screen height the sheet can occupy. */
  maxHeightFraction: number;
  /** When true, the sheet locks at maxHeight (form/search flows that need
   *  the full advertised height). When false, the sheet sizes to content
   *  (action/compact flows that should feel small). */
  fillToMax: boolean;
}> = {
  // Tall, search-led — but not 0.95 (we leave room above so the sheet
  // never crowds the status bar / Dynamic Island).
  search:   { maxHeightFraction: 0.88, fillToMax: true  },
  // Compact contextual menu. Content-sized so a 3-option menu doesn't
  // stretch into a giant panel — but cap higher than half-screen so the
  // taller panels (e.g. Reading block's duration card) don't get clipped.
  action:   { maxHeightFraction: 0.72, fillToMax: false },
  // Medium edit form.
  edit:     { maxHeightFraction: 0.75, fillToMax: true  },
  // Tall creation form.
  creation: { maxHeightFraction: 0.88, fillToMax: true  },
  // Tiny menu / confirmation.
  compact:  { maxHeightFraction: 0.45, fillToMax: false },
  // Reserved for truly immersive flows.
  full:     { maxHeightFraction: 0.95, fillToMax: true  },
};

export function VYBCreationSheet({
  visible, onDismiss, title, onBack, children,
  variant = 'creation',
}: {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  /** When provided, a left-aligned back arrow renders next to the title. */
  onBack?: () => void;
  children: React.ReactNode;
  /** Pick a variant that matches the USER FLOW, not the visual ambition.
   *  See module-level docstring for the design contract. */
  variant?: VYBSheetVariant;
}) {
  const cfg = VARIANT_CONFIG[variant];
  return (
    <DraggableSheet
      visible={visible}
      onDismiss={onDismiss}
      showClose={false}
      // fillToMax variants want the sheet to lock at full max-height with
      // keyboard handled by inner ScrollView. Content-sized variants want
      // KAV (compact actions menus don't have scroll bodies that need to
      // own keyboard insets).
      keyboardAvoiding={!cfg.fillToMax}
      maxHeightFraction={cfg.maxHeightFraction}
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
      <View style={{ flex: cfg.fillToMax ? 1 : undefined }}>
        {children}
      </View>
    </DraggableSheet>
  );
}
