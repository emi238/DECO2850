import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from './src/theme';
import type { RootStackParamList } from './src/navigation';
import CaptureScreen from './src/screens/CaptureScreen';
import ModeScreen from './src/screens/ModeScreen';
import QuestionnaireScreen from './src/screens/QuestionnaireScreen';
import TaggingScreen from './src/screens/TaggingScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import Room3DScreen from './src/screens/Room3DScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            initialRouteName="Capture"
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="Capture" component={CaptureScreen} />
            <Stack.Screen name="Mode" component={ModeScreen} />
            <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
            <Stack.Screen name="Tagging" component={TaggingScreen} />
            <Stack.Screen name="Results" component={ResultsScreen} />
            <Stack.Screen name="Room3D" component={Room3DScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
