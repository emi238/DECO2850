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
import CreateAccountScreen from './src/screens/CreateAccountScreen';
import LoginScreen from './src/screens/LoginScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import HouseholdScreen from './src/screens/HouseholdScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HomeScreen from './src/screens/HomeScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import TaggingScreen from './src/screens/TaggingScreen';
import SpaceSavedScreen from './src/screens/SpaceSavedScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import TodoScreen from './src/screens/TodoScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import ResultsMapScreen from './src/screens/ResultsMapScreen';
import WhatChangedScreen from './src/screens/WhatChangedScreen';
import SelectBreedScreen from './src/screens/SelectBreedScreen';

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
              <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
              <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false }} />
              <Stack.Screen name="Household" component={HouseholdScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Capture" component={CaptureScreen} />
              <Stack.Screen name="Tagging" component={TaggingScreen} />
              <Stack.Screen name="SpaceSaved" component={SpaceSavedScreen} />
              <Stack.Screen name="Analysis" component={AnalysisScreen} />
              <Stack.Screen name="Todo" component={TodoScreen} />
              <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
              <Stack.Screen name="ResultsMap" component={ResultsMapScreen} />
              <Stack.Screen name="WhatChanged" component={WhatChangedScreen} />
              <Stack.Screen name="SelectBreed" component={SelectBreedScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
