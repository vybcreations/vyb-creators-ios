import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Montserrat_300Light, Montserrat_500Medium, Montserrat_500Medium_Italic,
  Montserrat_700Bold, Montserrat_700Bold_Italic,
  Montserrat_800ExtraBold,
} from '@expo-google-fonts/montserrat';
import { JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { colors as C } from './src/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/lib/auth';
import { AuthScreen } from './src/screens/AuthScreen';
import { UndoToastProvider } from './src/components/UndoToast';

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.gold} />
    </View>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <AuthScreen />;
  return <RootNavigator />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Montserrat_300Light, Montserrat_500Medium, Montserrat_500Medium_Italic,
    Montserrat_700Bold, Montserrat_700Bold_Italic,
    Montserrat_800ExtraBold,
    JetBrainsMono_500Medium, JetBrainsMono_600SemiBold,
  });

  if (!fontsLoaded) return <Splash />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bgBase }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <UndoToastProvider>
            <Gate />
          </UndoToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
