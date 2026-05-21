import React, { useEffect, useState } from 'react';
import { View, AccessibilityInfo } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ProfileScreen } from '../screens/ProfileScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { HabitsScreen } from '../screens/HabitsScreen';
import { ReadingScreen } from '../screens/ReadingScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { FocusScreen } from '../screens/FocusScreen';
import { CaptureScreen } from '../screens/CaptureScreen';
import { BookDetailScreen } from '../screens/BookDetailScreen';
import { FriendDetailScreen } from '../screens/FriendDetailScreen';
import { QRScannerScreen } from '../screens/QRScannerScreen';
import { CircleDetailScreen } from '../screens/CircleDetailScreen';
import { ChallengeDetailScreen } from '../screens/ChallengeDetailScreen';
import { ChallengePreviewScreen } from '../screens/ChallengePreviewScreen';
import { TabBar, TabId } from '../components/TabBar';
import { colors as C } from '../theme';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const active = state.routes[state.index].name as TabId;
  return <TabBar active={active} onChange={(id) => navigation.navigate(id)} />;
}

function TabsScreen() {
  // `shift` (RN Navigation v7) = fade + small horizontal translate that
  // respects tab order — moving Tasks→Reading slides one way, Reading→Tasks
  // slides the other. Turned off entirely when reduce-motion is on.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <Tabs.Navigator
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: C.bgBase },
          animation: reduceMotion ? 'none' : 'shift',
        }}
        tabBar={CustomTabBar}
        initialRouteName="home"
      >
        <Tabs.Screen name="home"    component={HomeScreen} />
        <Tabs.Screen name="habits"  component={HabitsScreen} />
        <Tabs.Screen name="tasks"   component={TasksScreen} />
        <Tabs.Screen name="reading" component={ReadingScreen} />
        <Tabs.Screen name="friends" component={FriendsScreen} />
        <Tabs.Screen name="profile" component={ProfileScreen} />
      </Tabs.Navigator>
    </View>
  );
}

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bgBase, card: C.bgBase, primary: C.gold, text: C.textPrimary, border: C.borderSubtle },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bgBase } }}>
        <Stack.Screen name="Tabs" component={TabsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="BookDetail" component={BookDetailScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="FriendDetail" component={FriendDetailScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="CircleDetail" component={CircleDetailScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ChallengePreview" component={ChallengePreviewScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Focus" component={FocusScreen} options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="Capture" component={CaptureScreen} options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
