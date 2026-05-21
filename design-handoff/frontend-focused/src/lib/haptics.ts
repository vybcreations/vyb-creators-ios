import * as Haptics from 'expo-haptics';

// Safe wrappers — never throw if haptics aren't available (simulator, denied perms).
export const hLight     = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} };
export const hMedium    = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} };
export const hSelection = () => { try { Haptics.selectionAsync(); } catch {} };
export const hSuccess   = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} };
export const hWarning   = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {} };
