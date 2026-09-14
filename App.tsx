import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from './src/theme';
import { FONT_MAP } from './src/fontMap';
import type { RootStackParamList } from './src/navigation';
import { useSession, useStoreHydrated } from './src/store/session';
import WelcomeScreen from './src/screens/WelcomeScreen';
import HomeScreen from './src/screens/HomeScreen';
import NewSpaceScreen from './src/screens/NewSpaceScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import ModeScreen from './src/screens/ModeScreen';
import QuestionnaireScreen from './src/screens/QuestionnaireScreen';
import TaggingScreen from './src/screens/TaggingScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import Room3DScreen from './src/screens/Room3DScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, primary: colors.orange },
};

export default function App() {
  const hydrated = useStoreHydrated();
  const [fontsLoaded] = useFonts(FONT_MAP);
  const onboarded = useSession((s) => s.onboarded);

  const ready = hydrated && fontsLoaded;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {!ready ? (
          <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.orange} />
          </View>
        ) : (
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              initialRouteName={onboarded ? 'Home' : 'Welcome'}
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="NewSpace" component={NewSpaceScreen} />
              <Stack.Screen name="Capture" component={CaptureScreen} />
              <Stack.Screen name="Mode" component={ModeScreen} />
              <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
              <Stack.Screen name="Tagging" component={TaggingScreen} />
              <Stack.Screen name="Results" component={ResultsScreen} />
              <Stack.Screen name="Room3D" component={Room3DScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
