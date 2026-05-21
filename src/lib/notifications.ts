import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Treat all local notifications as user-facing.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STORAGE_KEY = 'vyb:1111Reminder';
const ID_AM = 'vyb-1111-am';
const ID_PM = 'vyb-1111-pm';

export async function get1111Enabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v === '1';
}

export async function set1111Enabled(on: boolean): Promise<void> {
  if (on) {
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) throw new Error('Notifications permission denied');
    await scheduleBoth();
  } else {
    await cancelBoth();
  }
  await AsyncStorage.setItem(STORAGE_KEY, on ? '1' : '0');
}

async function scheduleBoth() {
  await cancelBoth();
  // 11:11 AM
  await Notifications.scheduleNotificationAsync({
    identifier: ID_AM,
    content: {
      title: '11:11',
      body: 'Make a wish — then make it real.',
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: 11, minute: 11, repeats: true } as any,
  });
  // 11:11 PM
  await Notifications.scheduleNotificationAsync({
    identifier: ID_PM,
    content: {
      title: '11:11',
      body: 'Quiet moment. What are you grateful for today?',
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: 23, minute: 11, repeats: true } as any,
  });
}

async function cancelBoth() {
  try { await Notifications.cancelScheduledNotificationAsync(ID_AM); } catch {}
  try { await Notifications.cancelScheduledNotificationAsync(ID_PM); } catch {}
}
